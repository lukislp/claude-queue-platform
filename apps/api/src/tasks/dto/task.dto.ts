import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  projectId: string;

  @IsString()
  @MinLength(1)
  prompt: string;

  // Modell-ID oder -Alias (z.B. "claude-sonnet-5", "opus"); leer = Standardmodell.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._:-]+$/)
  model?: string;
}
