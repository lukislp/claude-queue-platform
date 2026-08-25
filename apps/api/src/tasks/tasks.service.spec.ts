import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';

/** Baut eine gefälschte DbService, deren query() der Reihe nach die übergebenen Zeilen liefert. */
function fakeDb(rows: (Record<string, any> | null)[]) {
  const query = jest.fn();
  for (const row of rows) {
    query.mockResolvedValueOnce({ rows: row ? [row] : [] });
  }
  return { query } as any;
}

function makeTask(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 't1',
    user_id: 'u1',
    status: 'QUEUED',
    assigned_device_id: null,
    error: null,
    ...overrides,
  };
}

describe('TasksService', () => {
  const queueManager = { enqueue: jest.fn() } as any;
  let realtime: any;

  beforeEach(() => {
    realtime = {
      sendAbortToDevice: jest.fn(),
      emitTaskUpdate: jest.fn(),
      tryDispatchForUser: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => jest.clearAllMocks());

  describe('cancel', () => {
    it('rejects a task that has already finished', async () => {
      const db = fakeDb([makeTask({ status: 'COMPLETED' })]);
      const service = new TasksService(db, queueManager, realtime);
      await expect(service.cancel('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a task belonging to another user', async () => {
      const db = fakeDb([makeTask({ user_id: 'other' })]);
      const service = new TasksService(db, queueManager, realtime);
      await expect(service.cancel('u1', 't1')).rejects.toThrow(ForbiddenException);
    });

    it('cancels a running task and tells its device to stop', async () => {
      const running = makeTask({ status: 'RUNNING', assigned_device_id: 'dev1' });
      const db = fakeDb([running, { ...running, status: 'CANCELED' }]);
      const service = new TasksService(db, queueManager, realtime);

      const result = await service.cancel('u1', 't1');

      expect(result.status).toBe('CANCELED');
      expect(realtime.sendAbortToDevice).toHaveBeenCalledWith('dev1', 't1', 'cancel');
      expect(realtime.tryDispatchForUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('pause', () => {
    it('rejects a task that has already finished', async () => {
      const db = fakeDb([makeTask({ status: 'FAILED' })]);
      const service = new TasksService(db, queueManager, realtime);
      await expect(service.pause('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('does not abort a device for a task that is still only queued (nothing running to kill)', async () => {
      const queued = makeTask({ status: 'QUEUED', assigned_device_id: 'dev1' });
      const db = fakeDb([queued, { ...queued, status: 'PAUSED' }]);
      const service = new TasksService(db, queueManager, realtime);

      await service.pause('u1', 't1');

      expect(realtime.sendAbortToDevice).not.toHaveBeenCalled();
    });

    it('aborts the assigned device for a running task', async () => {
      const running = makeTask({ status: 'RUNNING', assigned_device_id: 'dev1' });
      const db = fakeDb([running, { ...running, status: 'PAUSED' }]);
      const service = new TasksService(db, queueManager, realtime);

      await service.pause('u1', 't1');

      expect(realtime.sendAbortToDevice).toHaveBeenCalledWith('dev1', 't1', 'pause');
    });
  });

  describe('resume', () => {
    it('rejects a task that is not paused', async () => {
      const db = fakeDb([makeTask({ status: 'QUEUED' })]);
      const service = new TasksService(db, queueManager, realtime);
      await expect(service.resume('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('re-enqueues a paused task in local-CLI mode via dispatch, not BullMQ', async () => {
      const paused = makeTask({ status: 'PAUSED' });
      const db = fakeDb([paused, { ...paused, status: 'QUEUED' }, { type: 'LOCAL_CLI' }]);
      const service = new TasksService(db, queueManager, realtime);

      await service.resume('u1', 't1');

      expect(realtime.tryDispatchForUser).toHaveBeenCalledWith('u1');
      expect(queueManager.enqueue).not.toHaveBeenCalled();
    });

    it('re-enqueues a paused task in API-key mode via BullMQ', async () => {
      const paused = makeTask({ status: 'PAUSED' });
      const db = fakeDb([paused, { ...paused, status: 'QUEUED' }, { type: 'API_KEY' }]);
      const service = new TasksService(db, queueManager, realtime);

      await service.resume('u1', 't1');

      expect(queueManager.enqueue).toHaveBeenCalledWith('u1', 't1');
    });
  });

  describe('retry', () => {
    it('rejects a task that has not failed', async () => {
      const db = fakeDb([makeTask({ status: 'QUEUED' })]);
      const service = new TasksService(db, queueManager, realtime);
      await expect(service.retry('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('requeues a failed task, clearing its error', async () => {
      const failed = makeTask({ status: 'FAILED', error: 'boom' });
      const requeued = { ...failed, status: 'QUEUED', error: null };
      const db = fakeDb([failed, requeued, { type: 'LOCAL_CLI' }]);
      const service = new TasksService(db, queueManager, realtime);

      const result = await service.retry('u1', 't1');

      expect(result.status).toBe('QUEUED');
      expect(result.error).toBeNull();
      expect(realtime.tryDispatchForUser).toHaveBeenCalledWith('u1');
    });
  });
});
