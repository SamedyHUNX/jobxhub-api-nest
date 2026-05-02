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
      jobId: string;
      userId: string;
    }
  };
  'jobxhub/resume.uploaded': {
    data: {
      userId: string;
    }
  };
  'jobxhub/email.prepare-daily-user-job-listings': {
    data: Record<string, never>;
  };
  'jobxhub/email.send-daily-job-listing': {
    data: {
      userId: string;
      userEmail: string;
      userFirstName: string;
      userLastName: string;
      aiPrompt?: string | null;
      jobListings: { id: string; title: string; organizationName: string }[];
    };
  };
  'jobxhub/org-membership.created': {
    data: {
      orgId: string;
      userId: string;
    }
  };
  'jobxhub/org-membership.deleted': {
    data: {
      orgId: string;
      userId: string;
    }
  };
};
