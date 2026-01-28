import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  username: string;

  @Expose()
  imageUrl: string;

  @Expose()
  userRole: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  dateOfBirth: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
