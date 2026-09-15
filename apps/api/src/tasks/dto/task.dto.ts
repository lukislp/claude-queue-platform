import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  projectId: string;

  @IsString()
  @MinLength(1)
  prompt: string;

  // Model ID or alias (e.g. "claude-sonnet-5", "opus"); empty = the default model.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._:-]+$/)
  model?: string;
}
