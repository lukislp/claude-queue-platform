import { ProjectsService, toFolderSlug } from './projects.service';

describe('toFolderSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(toFolderSlug('Blog Automation')).toBe('blog-automation');
  });

  it('transliterates German umlauts instead of dropping them', () => {
    expect(toFolderSlug('Über Größe')).toBe('ueber-groesse');
  });

  it('strips separators produced by leading/trailing punctuation', () => {
    expect(toFolderSlug('--Hello World!!--')).toBe('hello-world');
  });

  it('falls back to a default name when nothing usable remains', () => {
    expect(toFolderSlug('!!!')).toBe('project');
  });

  it('caps the length to keep paths reasonable', () => {
    expect(toFolderSlug('a'.repeat(100)).length).toBe(60);
  });
});

describe('ProjectsService.create', () => {
  it('avoids folder-name collisions by appending a numeric suffix', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [{ working_directory: 'my-project' }, { working_directory: 'my-project-2' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', working_directory: 'my-project-3' }] });
    const service = new ProjectsService({ query } as any);

    const project = await service.create('u1', { name: 'My Project' } as any);

    expect(project.workingDirectory).toBe('my-project-3');
    const insertParams = query.mock.calls[1][1];
    expect(insertParams[4]).toBe('my-project-3');
  });

  it('uses an explicitly given working directory as-is, without a collision check', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 'p1', working_directory: 'custom/path' }] });
    const service = new ProjectsService({ query } as any);

    await service.create('u1', { name: 'Whatever', workingDirectory: 'custom/path' } as any);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1][4]).toBe('custom/path');
  });
});
