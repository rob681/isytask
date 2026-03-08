import { z } from "zod";
import { hash } from "bcryptjs";
import { adminProcedure, adminOrPermissionProcedure, protectedProcedure, router } from "../trpc";
import { createUserSchema, updateUserSchema, ALL_PERMISSIONS } from "@isytask/shared";

const teamProcedure = adminOrPermissionProcedure("manage_team");

export const usersRouter = router({
  list: teamProcedure
    .input(
      z.object({
        role: z.enum(["ADMIN", "COLABORADOR", "CLIENTE"]).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.role && { role: input.role }),
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            avatarUrl: true,
            createdAt: true,
            clientProfile: {
              select: {
                id: true,
                companyName: true,
                monthlyTaskLimit: true,
                revisionLimitPerTask: true,
              },
            },
            colaboradorProfile: {
              select: {
                id: true,
                specialty: true,
                permissions: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.user.count({ where }),
      ]);

      return { users, total, pages: Math.ceil(total / input.pageSize) };
    }),

  getById: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          clientProfile: {
            select: {
              id: true,
              companyName: true,
              logoUrl: true,
              monthlyTaskLimit: true,
              revisionLimitPerTask: true,
              googleDriveFolderId: true,
            },
          },
          colaboradorProfile: {
            select: {
              id: true,
              specialty: true,
              permissions: true,
              assignedClients: {
                select: {
                  client: {
                    select: {
                      id: true,
                      companyName: true,
                      user: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }),

  create: teamProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await hash(input.password, 12);

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
          phone: input.phone,
          role: input.role,
          ...(input.role === "CLIENTE" && {
            clientProfile: {
              create: {
                monthlyTaskLimit: 10,
                revisionLimitPerTask: 3,
              },
            },
          }),
          ...(input.role === "COLABORADOR" && {
            colaboradorProfile: {
              create: {},
            },
          }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      return user;
    }),

  update: teamProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
        },
      });
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: false },
        select: { id: true, isActive: true },
      });
    }),

  // Any authenticated user: get own profile
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatarUrl: true,
      },
    });
  }),

  // Any authenticated user: update own profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        avatarUrl: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      });
    }),

  // Only real ADMIN can update permissions
  updatePermissions: adminProcedure
    .input(
      z.object({
        colaboradorProfileId: z.string(),
        permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.colaboradorProfile.update({
        where: { id: input.colaboradorProfileId },
        data: { permissions: input.permissions },
        select: { id: true, permissions: true },
      });
    }),
});
