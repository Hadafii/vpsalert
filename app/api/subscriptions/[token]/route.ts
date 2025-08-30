import { NextRequest, NextResponse } from "next/server";
import {
  getUserByUnsubscribeToken,
  getUserSubscriptions,
  upsertSubscription,
  unsubscribeFromModel,
  unsubscribeUser,
  getVPSModels,
} from "@/lib/queries";
import { z } from "zod";
import { logger } from "@/lib/logs";

const UpdateSubscriptionSchema = z.object({
  action: z.enum(["add", "remove"]),
  model: z.number().int().min(1).max(6),
  datacenter: z.string().min(2).max(5).toUpperCase(),
});

const BatchUpdateSchema = z.object({
  subscriptions: z
    .array(
      z.object({
        action: z.enum(["add", "remove"]),
        model: z.number().int().min(1).max(6),
        datacenter: z.string().min(2).max(5).toUpperCase(),
      })
    )
    .min(1)
    .max(20),
});

const validDatacenters = [
  "GRA",
  "SBG",
  "BHS",
  "WAW",
  "UK",
  "DE",
  "FR",
  "SGP",
  "SYD",
];

const validateToken = (token: string): boolean => {
  return /^[a-f0-9]{32}$/.test(token);
};

const enrichSubscriptionData = (subscriptions: any[]) => {
  const VPS_MODELS: Record<
    number,
    { name: string; specs: string; price: string }
  > = {
    1: {
      name: "VPS-1",
      specs: "4 vCores, 8GB RAM, 75GB SSD",
      price: "US$4.20",
    },
    2: {
      name: "VPS-2",
      specs: "6 vCores, 12GB RAM, 100GB SSD",
      price: "US$6.75",
    },
    3: {
      name: "VPS-3",
      specs: "8 vCores, 24GB RAM, 200GB SSD",
      price: "US$12.75",
    },
    4: {
      name: "VPS-4",
      specs: "12 vCores, 48GB RAM, 300GB SSD",
      price: "US$25.08",
    },
    5: {
      name: "VPS-5",
      specs: "16 vCores, 64GB RAM, 350GB SSD",
      price: "US$34.34",
    },
    6: {
      name: "VPS-6",
      specs: "24 vCores, 96GB RAM, 400GB SSD",
      price: "US$45.39",
    },
  };

  const DATACENTER_INFO: Record<
    string,
    { name: string; country: string; flag: string }
  > = {
    GRA: { name: "Gravelines", country: "France", flag: "🇫🇷" },
    SBG: { name: "Strasbourg", country: "France", flag: "🇫🇷" },
    BHS: { name: "Beauharnois", country: "Canada", flag: "🇨🇦" },
    WAW: { name: "Warsaw", country: "Poland", flag: "🇵🇱" },
    UK: { name: "London", country: "United Kingdom", flag: "🇬🇧" },
    DE: { name: "Frankfurt", country: "Germany", flag: "🇩🇪" },
    FR: { name: "Roubaix", country: "France", flag: "🇫🇷" },
  };

  return subscriptions.map((sub) => ({
    ...sub,
    modelInfo: VPS_MODELS[sub.model] || {
      name: `Model ${sub.model}`,
      specs: "Unknown",
    },
    datacenterInfo: DATACENTER_INFO[sub.datacenter] || {
      name: sub.datacenter,
      country: "Unknown",
      flag: "🌍",
    },
  }));
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!validateToken(token)) {
      return NextResponse.json(
        {
          error: "Invalid token",
          message: "Token must be a 32-character hexadecimal string",
        },
        { status: 400 }
      );
    }

    const user = await getUserByUnsubscribeToken(token);
    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid token",
          message: "No user found with this token",
        },
        { status: 404 }
      );
    }

    const subscriptions = await getUserSubscriptions(user.id);
    const enrichedSubscriptions = enrichSubscriptionData(subscriptions);

    const activeSubscriptions = enrichedSubscriptions.filter(
      (sub) => sub.is_active
    );
    const inactiveSubscriptions = enrichedSubscriptions.filter(
      (sub) => !sub.is_active
    );

    const stats = {
      total: subscriptions.length,
      active: activeSubscriptions.length,
      inactive: inactiveSubscriptions.length,
      modelsCovered: Array.from(
        new Set(activeSubscriptions.map((s) => s.model))
      ).length,
      datacentersCovered: Array.from(
        new Set(activeSubscriptions.map((s) => s.datacenter))
      ).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified,
          created_at: user.created_at,
        },
        subscriptions: {
          active: activeSubscriptions,
          inactive: inactiveSubscriptions,
          all: enrichedSubscriptions,
        },
        statistics: stats,
        availableOptions: {
          models: getVPSModels(),
          datacenters: validDatacenters,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Get subscriptions error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve subscriptions",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!validateToken(token)) {
      return NextResponse.json(
        {
          error: "Invalid token",
          message: "Token must be a 32-character hexadecimal string",
        },
        { status: 400 }
      );
    }

    const user = await getUserByUnsubscribeToken(token);
    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid token",
          message: "No user found with this token",
        },
        { status: 404 }
      );
    }

    if (!user.email_verified) {
      return NextResponse.json(
        {
          error: "Email not verified",
          message:
            "Please verify your email address before managing subscriptions",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    let operations: Array<{
      action: string;
      model: number;
      datacenter: string;
    }> = [];

    if (body.subscriptions) {
      const validatedBatch = BatchUpdateSchema.parse(body);
      operations = validatedBatch.subscriptions;
    } else {
      const validatedSingle = UpdateSubscriptionSchema.parse(body);
      operations = [validatedSingle];
    }

    for (const op of operations) {
      if (!getVPSModels().includes(op.model)) {
        throw new Error(`Invalid VPS model: ${op.model}`);
      }

      if (!validDatacenters.includes(op.datacenter)) {
        throw new Error(`Invalid datacenter: ${op.datacenter}`);
      }
    }

    const results = {
      added: [] as any[],
      removed: [] as any[],
      errors: [] as string[],
    };

    for (const operation of operations) {
      try {
        if (operation.action === "add") {
          const subscription = await upsertSubscription(
            user.id,
            operation.model,
            operation.datacenter
          );
          results.added.push({
            model: operation.model,
            datacenter: operation.datacenter,
            subscription_id: subscription.id,
          });
        } else if (operation.action === "remove") {
          const success = await unsubscribeFromModel(
            user.id,
            operation.model,
            operation.datacenter
          );

          if (success) {
            results.removed.push({
              model: operation.model,
              datacenter: operation.datacenter,
            });
          } else {
            results.errors.push(
              `Failed to remove subscription for model ${operation.model} in ${operation.datacenter}`
            );
          }
        }
      } catch (error) {
        results.errors.push(
          `Error processing ${operation.action} for model ${operation.model} in ${operation.datacenter}: ${(error as Error).message}`
        );
      }
    }

    const updatedSubscriptions = await getUserSubscriptions(user.id);
    const activeCount = updatedSubscriptions.filter(
      (sub) => sub.is_active
    ).length;

    logger.log(
      `Subscriptions updated for user ${user.email}: +${results.added.length}, -${results.removed.length}, errors: ${results.errors.length}`
    );

    return NextResponse.json({
      success: results.errors.length === 0,
      message: `Successfully processed ${results.added.length + results.removed.length} operations${results.errors.length > 0 ? ` with ${results.errors.length} errors` : ""}`,
      data: {
        results,
        summary: {
          operations_processed: results.added.length + results.removed.length,
          subscriptions_added: results.added.length,
          subscriptions_removed: results.removed.length,
          errors: results.errors.length,
          current_active_subscriptions: activeCount,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Update subscriptions error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "Invalid request data",
          details: error.issues.map((e: any) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    if ((error as Error).message.includes("Invalid")) {
      return NextResponse.json(
        {
          error: "Invalid data",
          message: (error as Error).message,
          validModels: getVPSModels(),
          validDatacenters,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to update subscriptions",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!validateToken(token)) {
      return NextResponse.json(
        {
          error: "Invalid token",
          message: "Token must be a 32-character hexadecimal string",
        },
        { status: 400 }
      );
    }

    const user = await getUserByUnsubscribeToken(token);
    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid token",
          message: "No user found with this token",
        },
        { status: 404 }
      );
    }

    const currentSubscriptions = await getUserSubscriptions(user.id);
    const activeCount = currentSubscriptions.filter(
      (sub) => sub.is_active
    ).length;

    if (activeCount === 0) {
      return NextResponse.json({
        success: true,
        message: "User already has no active subscriptions",
        data: {
          email: user.email,
          subscriptions_removed: 0,
          was_already_unsubscribed: true,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const success = await unsubscribeUser(user.id);

    if (success) {
      logger.log(
        `User ${user.email} completely unsubscribed (${activeCount} subscriptions deactivated)`
      );

      return NextResponse.json({
        success: true,
        message: "Successfully unsubscribed from all notifications",
        data: {
          email: user.email,
          subscriptions_removed: activeCount,
          unsubscribed_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error("Failed to unsubscribe user");
    }
  } catch (error) {
    logger.error("Complete unsubscribe error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to unsubscribe user",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!validateToken(token)) {
      return new Response(null, { status: 400 });
    }

    const user = await getUserByUnsubscribeToken(token);
    if (!user) {
      return new Response(null, { status: 404 });
    }

    const subscriptions = await getUserSubscriptions(user.id);
    const activeCount = subscriptions.filter((sub) => sub.is_active).length;

    return new Response(null, {
      status: 200,
      headers: {
        "X-Token-Valid": "true",
        "X-Email-Verified": user.email_verified.toString(),
        "X-Active-Subscriptions": activeCount.toString(),
      },
    });
  } catch (error) {
    return new Response(null, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
