/**
 * Unit tests UT-01–UT-04: Create Customer form validation.
 * Uses React Testing Library. Traceable: 02-test-spec.md, AC-6.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { CreateCustomerWizard } from "./create-customer";
import { queryClient } from "@/utils/trpc";

vi.mock("@slushomat/env/web", () => ({
  env: { VITE_SERVER_URL: "http://localhost:3000" },
}));

function renderWithProviders(ui: ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("CreateCustomerWizard — step 1 validation (UT-01, UT-02)", () => {
  it("UT-01: shows validation error when step 1 submitted with all fields empty", async () => {
    renderWithProviders(<CreateCustomerWizard />);

    const submitBtn = screen.getByRole("button", {
      name: /create user & continue/i,
    });
    await userEvent.click(submitBtn);

    // Expect error indicating required fields — stub has no validation, so this fails until T03
    const alert = screen.queryByRole("alert") ?? screen.queryByText(/required|missing/i);
    expect(alert).toBeInTheDocument();
  });

  it("UT-02: shows validation error when step 1 submitted with only email filled", async () => {
    renderWithProviders(<CreateCustomerWizard />);

    await userEvent.type(screen.getByLabelText(/^email$/i), "test@example.com");
    const submitBtn = screen.getAllByRole("button", {
      name: /create user & continue/i,
    })[0];
    await userEvent.click(submitBtn);

    // Expect error for missing password and name (avoid matching "Organization name" label)
    const alert = screen.queryByRole("alert") ?? screen.queryByText(/required|missing|email|password/i);
    expect(alert).toBeInTheDocument();
  });
});

describe("CreateCustomerWizard — step 2 validation (UT-03, UT-04)", () => {
  it("UT-03: shows validation error when step 2 submitted with name and slug empty", async () => {
    const { container } = renderWithProviders(<CreateCustomerWizard initialStep={2} />);

    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();
    const submitBtn = form!.querySelector('button[type="submit"]')!;
    await userEvent.click(submitBtn);

    // Expect error indicating required fields (name, slug)
    expect(
      screen.getByText(/organization name and slug are required/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/organization name and slug are required/i)).toHaveAttribute(
      "role",
      "alert"
    );
  });

  it("UT-04: shows validation error when step 2 submitted with only name filled", async () => {
    const { container } = renderWithProviders(<CreateCustomerWizard initialStep={2} />);

    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText(/^organization name$/i),
      "Test Org",
    );
    const submitBtn = form!.querySelector('button[type="submit"]')!;
    await userEvent.click(submitBtn);

    // Expect error for missing slug (use getAllBy when Strict Mode may duplicate)
    const alerts = screen.getAllByText(/organization name and slug are required/i);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]).toHaveAttribute("role", "alert");
  });
});
