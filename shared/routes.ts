import { z } from 'zod';
import { insertProjectSchema, projects, files, investments, users, submissions, offerings, coproducers, royaltySplits, events, donations, cypherPasses, votes } from './schema';
import { ROLES, emailSchema, passwordSchema, usernameSchema } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>().nullable(),
      },
    },
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: z.object({
        email: emailSchema,
        password: passwordSchema,
        username: usernameSchema,
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        409: z.object({ message: z.string() }),
      }
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({
        email: emailSchema,
        // Not passwordSchema: an existing password set under older rules must
        // still be accepted at login. Length rules belong on registration.
        password: z.string().min(1, "Password is required").max(200),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    changePassword: {
      method: 'POST' as const,
      path: '/api/auth/change-password' as const,
      input: z.object({
        currentPassword: z.string().min(1).max(200),
        newPassword: passwordSchema,
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
      }
    },
    subscribe: {
      method: 'POST' as const,
      path: '/api/auth/subscribe' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    updateRoles: {
      method: 'PATCH' as const,
      path: '/api/auth/me/roles' as const,
      input: z.object({ roles: z.array(z.enum(ROLES)) }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  projects: {
    list: {
      method: 'GET' as const,
      path: '/api/projects' as const,
      responses: {
        200: z.array(z.custom<typeof projects.$inferSelect & { creator: typeof users.$inferSelect; investmentCount: number }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/projects/:id' as const,
      responses: {
        200: z.custom<typeof projects.$inferSelect & {
          creator: typeof users.$inferSelect,
          files: (typeof files.$inferSelect & { uploader: typeof users.$inferSelect })[],
          investments: (typeof investments.$inferSelect & { investor: typeof users.$inferSelect })[],
          submissions: (typeof submissions.$inferSelect & { user: typeof users.$inferSelect })[],
          coproducers: (typeof coproducers.$inferSelect & { user: typeof users.$inferSelect })[],
          royaltySplits: typeof royaltySplits.$inferSelect[],
        }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects' as const,
      input: insertProjectSchema.omit({ creatorId: true }),
      responses: {
        201: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  files: {
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/files' as const,
      input: z.object({
        name: z.string(),
        url: z.string(),
        type: z.string(),
        visibility: z.enum(["private", "public"]).default("private"),
      }),
      responses: {
        201: z.custom<typeof files.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  investments: {
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/investments' as const,
      input: z.object({
        amount: z.coerce.number(),
        percentage: z.coerce.number().min(1).max(10),
      }),
      responses: {
        201: z.custom<typeof investments.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
      },
    },
  },
  offerings: {
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/offerings' as const,
      input: z.object({ amount: z.coerce.number().min(1) }),
      responses: {
        201: z.custom<typeof offerings.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/offerings' as const,
      responses: {
        200: z.array(z.custom<typeof offerings.$inferSelect & { user: typeof users.$inferSelect }>()),
      },
    },
  },
  coproducers: {
    select: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/select-coproducers' as const,
      responses: {
        200: z.array(z.custom<typeof coproducers.$inferSelect & { user: typeof users.$inferSelect }>()),
        400: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/coproducers' as const,
      responses: {
        200: z.array(z.custom<typeof coproducers.$inferSelect & { user: typeof users.$inferSelect }>()),
      },
    },
  },
  submissions: {
    listAll: {
      method: 'GET' as const,
      path: '/api/submissions' as const,
      responses: {
        200: z.array(z.custom<typeof submissions.$inferSelect & {
          user: typeof users.$inferSelect,
          project: typeof projects.$inferSelect,
        }>()),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/submissions' as const,
      responses: {
        200: z.array(z.custom<typeof submissions.$inferSelect & { user: typeof users.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/submissions' as const,
      input: z.object({
        type: z.string(),
        title: z.string(),
        description: z.string().optional(),
        fileUrl: z.string().optional(),
        visibility: z.enum(["private", "public"]).default("private"),
        licenseBestowalAmount: z.coerce.number().min(0).optional(),
        sampleClearancePercent: z.coerce.number().min(0).max(30).optional(),
      }),
      responses: {
        201: z.custom<typeof submissions.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events' as const,
      responses: {
        200: z.array(z.custom<typeof events.$inferSelect & { voteCount: number }>()),
      },
    },
  },
  donations: {
    create: {
      method: 'POST' as const,
      path: '/api/donations' as const,
      input: z.object({ amount: z.coerce.number().min(1) }),
      responses: {
        201: z.custom<typeof donations.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    mySummary: {
      method: 'GET' as const,
      path: '/api/donations/me' as const,
      responses: {
        200: z.object({
          donations: z.array(z.custom<typeof donations.$inferSelect>()),
          yearTotal: z.number(),
          hasPass: z.boolean(),
          pass: z.custom<typeof cypherPasses.$inferSelect>().nullable(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  voting: {
    cast: {
      method: 'POST' as const,
      path: '/api/events/:eventId/votes' as const,
      input: z.object({ artistUserId: z.number() }),
      responses: {
        201: z.custom<typeof votes.$inferSelect>(),
        400: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
      },
    },
    leaderboard: {
      method: 'GET' as const,
      path: '/api/events/:eventId/votes' as const,
      responses: {
        200: z.array(z.object({
          artistUserId: z.number(),
          username: z.string(),
          displayName: z.string().nullable(),
          voteCount: z.number(),
        })),
      },
    },
  },
  ministry: {
    stats: {
      method: 'GET' as const,
      path: '/api/ministry/stats' as const,
      responses: {
        200: z.object({ passHolders: z.number(), totalVotes: z.number() }),
      },
    },
    artists: {
      method: 'GET' as const,
      path: '/api/ministry/artists' as const,
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
  },
  admin: {
    grantMinistry: {
      method: 'PATCH' as const,
      path: '/api/admin/grant-ministry' as const,
      input: z.object({ username: z.string().min(1) }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
