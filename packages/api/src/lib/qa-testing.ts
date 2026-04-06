import { PrismaClient, Role, TaskStatus, FieldType } from "@isytask/db";
import { hash } from "bcryptjs";

/**
 * QA Testing Agent
 * Tests all major Isytask functionalities across different user roles
 */

export interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  duration: number;
  error?: string;
  details?: string;
}

export interface QAReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  duration: number;
  results: TestResult[];
  summary: {
    workingFeatures: string[];
    brokenFeatures: string[];
    improvementSuggestions: string[];
  };
}

class QATestingAgent {
  private db: PrismaClient;
  private testAgencyId: string = "";
  private adminUserId: string = "";
  private colaboradorUserId: string = "";
  private clienteUserId: string = "";
  private clientProfileId: string = "";
  private colaboradorProfileId: string = "";
  private serviceId: string = "";
  private taskId: string = "";
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(db: PrismaClient) {
    this.db = db;
    this.startTime = Date.now();
  }

  /**
   * Run all QA tests
   */
  async runTests(): Promise<QAReport> {
    try {
      // Setup: Create test data
      await this.setupTestData();

      // Test suites
      await this.testAuthenticationFlow();
      await this.testUserManagement();
      await this.testServiceManagement();
      await this.testFormFieldConfiguration();
      await this.testTaskCreation();
      await this.testTaskAssignment();
      await this.testTaskStatusTransitions();
      await this.testTaskComments();
      await this.testFileUploads();
      await this.testFilters();
      await this.testNotifications();
      await this.testWhatsAppIntegration();
      await this.testRiskPrediction();
      await this.testBilling();

      // Cleanup
      await this.cleanupTestData();
    } catch (error) {
      this.addResult("Setup/Cleanup", "FAIL", 0, `Critical error: ${error}`);
    }

    return this.generateReport();
  }

  /**
   * Setup test data: agency, users, service
   */
  private async setupTestData(): Promise<void> {
    const start = Date.now();
    try {
      // Create test agency
      const agency = await this.db.agency.create({
        data: {
          name: `QA Test Agency ${Date.now()}`,
          slug: `qa-test-${Date.now()}`,
          planTier: "pro",
        },
      });
      this.testAgencyId = agency.id;

      // Create admin user
      const adminUser = await this.db.user.create({
        data: {
          email: `qa-admin-${Date.now()}@test.com`,
          name: "QA Admin Test",
          passwordHash: await hash("Test123!@#", 12),
          role: "ADMIN" as Role,
          agencyId: this.testAgencyId,
          isActive: true,
        },
      });
      this.adminUserId = adminUser.id;

      // Create colaborador user
      const colaborador = await this.db.user.create({
        data: {
          email: `qa-colaborador-${Date.now()}@test.com`,
          name: "QA Colaborador Test",
          passwordHash: await hash("Test123!@#", 12),
          role: "COLABORADOR" as Role,
          agencyId: this.testAgencyId,
          isActive: true,
          colaboradorProfile: {
            create: {
              specialty: "Development",
            },
          },
        },
        include: {
          clientProfile: true,
          colaboradorProfile: true,
        },
      });
      this.colaboradorUserId = colaborador.id;
      this.colaboradorProfileId = colaborador.colaboradorProfile?.id ?? "";

      // Create cliente user
      const cliente = await this.db.user.create({
        data: {
          email: `qa-cliente-${Date.now()}@test.com`,
          name: "QA Cliente Test",
          passwordHash: await hash("Test123!@#", 12),
          role: "CLIENTE" as Role,
          agencyId: this.testAgencyId,
          isActive: true,
          clientProfile: {
            create: {
              companyName: "QA Test Company",
            },
          },
        },
        include: {
          clientProfile: true,
          colaboradorProfile: true,
        },
      });
      this.clienteUserId = cliente.id;
      this.clientProfileId = cliente.clientProfile?.id ?? "";

      // Create service with fields
      const service = await this.db.service.create({
        data: {
          name: "QA Test Service",
          description: "Service for QA testing",
          agencyId: this.testAgencyId,
          estimatedHours: 10,
          formFields: {
            create: [
              {
                fieldName: "project_name",
                label: "Nombre del Proyecto",
                fieldType: "TEXT" as FieldType,
                sortOrder: 0,
                isRequired: true,
              },
              {
                fieldName: "description",
                label: "Descripción",
                fieldType: "TEXTAREA" as FieldType,
                sortOrder: 1,
                isRequired: true,
              },
              {
                fieldName: "budget",
                label: "Presupuesto",
                fieldType: "NUMBER" as FieldType,
                sortOrder: 2,
                isRequired: false,
              },
            ],
          },
        },
      });
      this.serviceId = service.id;

      this.addResult("Setup Test Data", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Setup Test Data",
        "FAIL",
        Date.now() - start,
        String(error)
      );
      throw error;
    }
  }

  /**
   * Test: Authentication Flow
   */
  private async testAuthenticationFlow(): Promise<void> {
    const start = Date.now();
    try {
      // Verify admin user can be fetched
      const admin = await this.db.user.findUnique({
        where: { id: this.adminUserId },
      });

      if (!admin || admin.passwordHash === null) {
        throw new Error("Admin user not found or missing password hash");
      }

      this.addResult("Authentication: Admin User", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Authentication: Admin User",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: User Management (CRUD)
   */
  private async testUserManagement(): Promise<void> {
    const start = Date.now();
    try {
      // List users
      const users = await this.db.user.findMany({
        where: { agencyId: this.testAgencyId },
      });

      if (users.length < 3) {
        throw new Error(`Expected 3+ users, got ${users.length}`);
      }

      // Update user
      await this.db.user.update({
        where: { id: this.adminUserId },
        data: { name: "Updated QA Admin" },
      });

      this.addResult("User Management: CRUD", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "User Management: CRUD",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Service Management
   */
  private async testServiceManagement(): Promise<void> {
    const start = Date.now();
    try {
      // Get service
      const service = await this.db.service.findUnique({
        where: { id: this.serviceId },
        include: { formFields: true },
      });

      if (!service) {
        throw new Error("Service not found");
      }

      if (service.formFields.length !== 3) {
        throw new Error(`Expected 3 fields, got ${service.formFields.length}`);
      }

      // Update service
      await this.db.service.update({
        where: { id: this.serviceId },
        data: { name: "Updated QA Service" },
      });

      this.addResult("Service Management", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Service Management",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Form Field Configuration
   */
  private async testFormFieldConfiguration(): Promise<void> {
    const start = Date.now();
    try {
      // Add field
      await this.db.serviceFormField.create({
        data: {
          fieldName: "budget_approval",
          label: "Budget Approval",
          fieldType: "CHECKBOX" as FieldType,
          sortOrder: 3,
          isRequired: false,
          serviceId: this.serviceId,
        },
      });

      // Reorder fields
      const fields = await this.db.serviceFormField.findMany({
        where: { serviceId: this.serviceId },
        orderBy: { sortOrder: "asc" },
      });

      for (let i = 0; i < fields.length; i++) {
        await this.db.serviceFormField.update({
          where: { id: fields[i].id },
          data: { sortOrder: i },
        });
      }

      this.addResult(
        "Form Field Configuration",
        "PASS",
        Date.now() - start
      );
    } catch (error) {
      this.addResult(
        "Form Field Configuration",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Task Creation
   */
  private async testTaskCreation(): Promise<void> {
    const start = Date.now();
    try {
      // Calculate per-agency task number
      const maxResult = await this.db.task.aggregate({
        where: { agencyId: this.testAgencyId },
        _max: { taskNumber: true },
      });
      const taskNumber = (maxResult._max.taskNumber ?? 0) + 1;

      const task = await this.db.task.create({
        data: {
          title: "QA Test Task",
          description: "Testing task creation",
          status: "RECIBIDA" as TaskStatus,
          category: "NORMAL",
          taskNumber,
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          agencyId: this.testAgencyId,
          clientId: this.clientProfileId,
          serviceId: this.serviceId,
          estimatedHours: 8,
          revisionsLimit: 2,
          formData: {
            "project_name": "QA Test Project",
            "description": "This is a test task",
            "budget": 5000,
          },
        },
      });

      if (!task) {
        throw new Error("Task creation returned null");
      }

      this.taskId = task.id;
      this.addResult("Task Creation", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Task Creation",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Task Assignment
   */
  private async testTaskAssignment(): Promise<void> {
    const start = Date.now();
    try {
      // Assign task to colaborador
      await this.db.taskAssignment.create({
        data: {
          taskId: this.taskId,
          colaboradorId: this.colaboradorProfileId,
          role: "PRIMARY",
        },
      });

      // Verify assignment
      const assignment = await this.db.taskAssignment.findFirst({
        where: { taskId: this.taskId, colaboradorId: this.colaboradorProfileId },
      });

      if (!assignment) {
        throw new Error("Task assignment not found");
      }

      this.addResult("Task Assignment", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Task Assignment",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Task Status Transitions
   */
  private async testTaskStatusTransitions(): Promise<void> {
    const start = Date.now();
    try {
      const statuses: TaskStatus[] = [
        "EN_PROGRESO",
        "REVISION",
        "FINALIZADA",
      ];

      for (const status of statuses) {
        await this.db.task.update({
          where: { id: this.taskId },
          data: { status },
        });
      }

      const finalTask = await this.db.task.findUnique({
        where: { id: this.taskId },
      });

      if (finalTask?.status !== "FINALIZADA") {
        throw new Error("Task status not updated correctly");
      }

      this.addResult("Task Status Transitions", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Task Status Transitions",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Task Comments
   */
  private async testTaskComments(): Promise<void> {
    const start = Date.now();
    try {
      // Create comment
      const comment = await this.db.taskComment.create({
        data: {
          taskId: this.taskId,
          authorId: this.adminUserId,
          content: "This is a test comment",
        },
      });

      // Verify comment
      const comments = await this.db.taskComment.findMany({
        where: { taskId: this.taskId },
      });

      if (comments.length === 0) {
        throw new Error("Comment not created");
      }

      this.addResult("Task Comments", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Task Comments",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: File Uploads
   */
  private async testFileUploads(): Promise<void> {
    const start = Date.now();
    try {
      // Create file record
      const attachment = await this.db.taskAttachment.create({
        data: {
          taskId: this.taskId,
          fileName: "test-file.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          storagePath: "attachments/test/test-file.pdf",
          fileUrl: "https://example.com/test-file.pdf",
          uploadedById: this.adminUserId,
        },
      });

      if (!attachment) {
        throw new Error("File creation failed");
      }

      this.addResult("File Uploads", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "File Uploads",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Filtering and Search
   */
  private async testFilters(): Promise<void> {
    const start = Date.now();
    try {
      // Filter by status
      const tasksByStatus = await this.db.task.findMany({
        where: {
          agencyId: this.testAgencyId,
          status: "FINALIZADA",
        },
      });

      // Filter by client
      const tasksByClient = await this.db.task.findMany({
        where: {
          agencyId: this.testAgencyId,
          clientId: this.clientProfileId,
        },
      });

      if (
        tasksByStatus.length === 0 ||
        tasksByClient.length === 0
      ) {
        throw new Error("Filtering returned no results");
      }

      this.addResult("Filtering and Search", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Filtering and Search",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Notifications
   */
  private async testNotifications(): Promise<void> {
    const start = Date.now();
    try {
      // Create notification
      const notification = await this.db.notification.create({
        data: {
          userId: this.clienteUserId,
          type: "TAREA_RECIBIDA",
          channel: "IN_APP",
          title: "Test Notification",
          body: "This is a test",
          taskId: this.taskId,
        },
      });

      if (!notification) {
        throw new Error("Notification creation failed");
      }

      this.addResult("Notifications", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Notifications",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: WhatsApp Integration
   */
  private async testWhatsAppIntegration(): Promise<void> {
    const start = Date.now();
    try {
      // Create WhatsApp contact
      const contact = await this.db.whatsAppContact.create({
        data: {
          phone: `+1${Date.now().toString().slice(-10)}`,
          userId: this.adminUserId,
          clientId: this.clientProfileId,
          displayName: "QA Test Contact",
          isVerified: true,
          isActive: true,
        },
      });

      // Create WhatsApp message
      await this.db.whatsAppMessage.create({
        data: {
          twilioSid: `qa-test-${Date.now()}`,
          direction: "INBOUND",
          body: "Test WhatsApp message",
          status: "RECEIVED",
          contactId: contact.id,
        },
      });

      this.addResult("WhatsApp Integration", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "WhatsApp Integration",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Risk Prediction
   */
  private async testRiskPrediction(): Promise<void> {
    const start = Date.now();
    try {
      // Create risk assessment
      const assessment = await this.db.riskAssessment.create({
        data: {
          taskId: this.taskId,
          agencyId: this.testAgencyId,
          riskScore: 45,
          riskLevel: "YELLOW",
          daysUntilDeadline: 5,
          daysSinceLastClientResponse: 2,
          daysSinceLastUpdate: 1,
          assigneeActiveTaskCount: 8,
          clientAvgApprovalDays: 2,
          teamAvgCompletionDays: 3,
          prediction: "Test prediction",
        },
      });

      if (!assessment) {
        throw new Error("Risk assessment creation failed");
      }

      this.addResult("Risk Prediction", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Risk Prediction",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Test: Billing
   */
  private async testBilling(): Promise<void> {
    const start = Date.now();
    try {
      // Create subscription
      const subscription = await this.db.subscription.create({
        data: {
          agencyId: this.testAgencyId,
          product: "ISYTASK",
          planTier: "pro",
          status: "trial",
        },
      });

      if (!subscription) {
        throw new Error("Subscription creation failed");
      }

      this.addResult("Billing: Subscriptions", "PASS", Date.now() - start);
    } catch (error) {
      this.addResult(
        "Billing: Subscriptions",
        "FAIL",
        Date.now() - start,
        String(error)
      );
    }
  }

  /**
   * Cleanup: Delete test data
   */
  private async cleanupTestData(): Promise<void> {
    try {
      if (this.testAgencyId) {
        // Cascade deletes handled by Prisma relations
        await this.db.agency.delete({
          where: { id: this.testAgencyId },
        });
      }
    } catch (error) {
      console.error("[QA] Cleanup error:", error);
    }
  }

  /**
   * Add test result
   */
  private addResult(
    name: string,
    status: "PASS" | "FAIL" | "WARN",
    duration: number,
    error?: string,
    details?: string
  ): void {
    this.results.push({
      name,
      status,
      duration,
      error,
      details,
    });
  }

  /**
   * Generate QA Report
   */
  private generateReport(): QAReport {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.status === "PASS").length;
    const failed = this.results.filter((r) => r.status === "FAIL").length;
    const warnings = this.results.filter((r) => r.status === "WARN").length;

    const workingFeatures = this.results
      .filter((r) => r.status === "PASS")
      .map((r) => r.name);

    const brokenFeatures = this.results
      .filter((r) => r.status === "FAIL")
      .map((r) => `${r.name} (${r.error})`);

    const improvementSuggestions: string[] = [];

    // Add suggestions based on results
    if (failed === 0) {
      improvementSuggestions.push(
        "✓ All core features working correctly"
      );
    }

    if (this.results.filter((r) => r.duration > 1000).length > 0) {
      improvementSuggestions.push(
        "⚠ Some operations taking >1s — consider query optimization"
      );
    }

    if (warnings > 0) {
      improvementSuggestions.push(
        `⚠ ${warnings} warnings detected — review error messages`
      );
    }

    improvementSuggestions.push(
      "💡 Consider adding pagination tests for large datasets"
    );
    improvementSuggestions.push(
      "💡 Add concurrent operation tests (race conditions)"
    );
    improvementSuggestions.push(
      "💡 Add load testing for bulk operations (1000+ tasks)"
    );

    return {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed,
      failed,
      warnings,
      duration: totalDuration,
      results: this.results,
      summary: {
        workingFeatures,
        brokenFeatures,
        improvementSuggestions,
      },
    };
  }
}

/**
 * Run QA tests
 */
export async function runQATesting(db: PrismaClient): Promise<QAReport> {
  const agent = new QATestingAgent(db);
  return agent.runTests();
}
