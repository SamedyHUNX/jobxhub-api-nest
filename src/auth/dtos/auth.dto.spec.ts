import { validate } from 'class-validator';
import { SignUpDto, ResetPasswordDto } from './auth.dto';

describe('Auth DTOs Validation', () => {
    describe('SignUpDto', () => {
        it('should fail if passwords do not match', async () => {
            const dto = new SignUpDto();
            dto.username = 'testuser';
            dto.email = 'test@example.com';
            dto.password = 'Password123!';
            dto.confirmPassword = 'Password123'; // Mismatch
            dto.firstName = 'Test';
            dto.lastName = 'User';
            dto.dateOfBirth = '2000-01-01';

            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            const confirmPasswordError = errors.find(
                (e) => e.property === 'confirmPassword',
            );
            expect(confirmPasswordError).toBeDefined();
            expect(confirmPasswordError!.constraints).toHaveProperty('match');
        });

        it('should succeed if passwords match', async () => {
            const dto = new SignUpDto();
            dto.username = 'testuser';
            dto.email = 'test@example.com';
            dto.password = 'Password123!';
            dto.confirmPassword = 'Password123!';
            dto.firstName = 'Test';
            dto.lastName = 'User';
            dto.dateOfBirth = '2000-01-01';

            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });
    });

    describe('ResetPasswordDto', () => {
        it('should fail if passwords do not match', async () => {
            const dto = new ResetPasswordDto();
            dto.token = 'some-token';
            dto.newPassword = 'NewPassword123!';
            dto.confirmPassword = 'NewPassword123'; // Mismatch

            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            const confirmPasswordError = errors.find(
                (e) => e.property === 'confirmPassword',
            );
            expect(confirmPasswordError).toBeDefined();
            expect(confirmPasswordError!.constraints).toHaveProperty('match');
        });

        it('should fail if inputs are empty', async () => {
            const dto = new ResetPasswordDto();
            // missing token and passwords

            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);

            const tokenError = errors.find((e) => e.property === 'token');
            expect(tokenError!.constraints).toHaveProperty('isNotEmpty');

            const confirmError = errors.find((e) => e.property === 'confirmPassword');
            expect(confirmError!.constraints).toHaveProperty('isNotEmpty');
        });

        it('should succeed if valid', async () => {
            const dto = new ResetPasswordDto();
            dto.token = 'some-token';
            dto.newPassword = 'NewPassword123!';
            dto.confirmPassword = 'NewPassword123!';

            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });
    });
});
