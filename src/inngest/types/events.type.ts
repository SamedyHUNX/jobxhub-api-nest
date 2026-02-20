export type UserCreatedData = {
  userId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  acceptLanguage: string;
  verificationUrl: string;
};

export type UserUpdatedData = {
  userId: string;
  fields: Partial<UserCreatedData>;
};

export type JobPostedData = {
  jobId: string;
  userId: string;
  title: string;
  description: string;
  salary?: number;
};

export type ResetPasswordRequestData = {
  email: string;
  resetUrl: string;
  acceptLanguage: string;
};

export type OrganizationJSON = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type WebhookData<T> = {
  data: {
    data: T;
    raw: string;
    headers: Record<string, string>;
  };
};

export type Events = {
  'jobxhub/user.created': {
    data: UserCreatedData;
  };
  'jobxhub/user.updated': {
    data: UserUpdatedData;
  };
  'jobxhub/user.reset_password': {
    data: ResetPasswordRequestData;
  };
  'jobxhub/job.posted': {
    data: JobPostedData;
  };
  'jobxhub/organization.created': {
    data: OrganizationJSON;
  };
  'jobxhub/job_listing_application.created': {
    data: {
      jobListingId: string;
      userId: string
    }
  };
  'jobxhub/resume.uploaded': {
    user: {
      id: string
    }
  }
};
