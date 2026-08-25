import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateConnectionDto {
  @IsIn(['API_KEY', 'LOCAL_CLI'])
  type: 'API_KEY' | 'LOCAL_CLI';

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  concurrencyLimit?: number;
}
