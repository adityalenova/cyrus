import { z, ZodError } from "zod";

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  errorResponse: Response;
  issues: Array<{ field: string; message: string }>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export async function validateRequestBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<ValidationResult<T>> {
  try {
    const json = await req.json();
    const parsed = schema.parse(json);
    return { success: true, data: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));

      const res = new Response(
        JSON.stringify({
          type: "https://cyrus.ai/errors/validation-error",
          title: "Request Validation Failed",
          status: 422,
          invalidParams: issues,
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/problem+json" },
        }
      );

      return { success: false, errorResponse: res, issues };
    }

    return {
      success: false,
      errorResponse: new Response(
        JSON.stringify({
          type: "https://cyrus.ai/errors/invalid-json",
          title: "Malformed JSON Body",
          status: 400,
        }),
        { status: 400, headers: { "Content-Type": "application/problem+json" } }
      ),
      issues: [{ field: "root", message: "Invalid JSON format" }],
    };
  }
}
