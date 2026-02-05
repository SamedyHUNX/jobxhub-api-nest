import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const SelectedOrgId = createParamDecorator(
    (_: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.cookies?.selectedOrgId;
    },
);

// @Get()
// findAll(@SelectedOrgId() orgId: string) {

// }