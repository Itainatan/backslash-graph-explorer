import { ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { PathQueryRequest } from '@graph-explorer/shared';
import { PATH_FILTER_IDS } from '../filters/filter.registry';

export const PATH_QUERY_LIMITS = {
  maxDepth: { min: 1, max: 30, default: 12 },
  limit: { min: 1, max: 500, default: 250 },
} as const;

/**
 * Decorators run bottom-up and validation stops at a field's first error, so the type check
 * (closest to the property) is reported before range checks.
 *
 * Validated against the filter registry, so a new filter needs no change here.
 * `filters` is a flat string array; a future `{ id, params }` shape would need
 * `@ValidateNested()` + `@Type(() => X)` or its inner fields would not be validated.
 */
export class PathQueryDto implements PathQueryRequest {
  @IsOptional()
  @ArrayUnique({ message: 'filters must not contain duplicates' })
  @IsIn(PATH_FILTER_IDS, {
    each: true,
    message: `each value in filters must be one of: ${PATH_FILTER_IDS.join(', ')}`,
  })
  @IsString({ each: true })
  @IsArray()
  filters: string[] = [];

  @IsOptional()
  @Max(PATH_QUERY_LIMITS.maxDepth.max)
  @Min(PATH_QUERY_LIMITS.maxDepth.min)
  @IsInt()
  maxDepth: number = PATH_QUERY_LIMITS.maxDepth.default;

  @IsOptional()
  @Max(PATH_QUERY_LIMITS.limit.max)
  @Min(PATH_QUERY_LIMITS.limit.min)
  @IsInt()
  limit: number = PATH_QUERY_LIMITS.limit.default;
}
