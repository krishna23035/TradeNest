import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

function renderRoute() {
  return render(<MemoryRouter initialEntries={["/paper"]}>
    <Routes>
      <Route path="/auth" element={<div>Sign in</div>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/paper" element={<div>Paper account</div>} />
      </Route>
    </Routes>
  </MemoryRouter>);
}

describe("paper account route guard", () => {
  beforeEach(() => {
    auth.getUser.mockReset();
    auth.onAuthStateChange.mockReset();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("redirects a signed-out visitor to authentication", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    renderRoute();
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
  });

  it("restores a persisted session before opening the protected route", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "demo-user" } }, error: null });
    renderRoute();
    expect(await screen.findByText("Paper account")).toBeInTheDocument();
  });

  it("rejects an expired or invalid session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT expired" } });
    renderRoute();
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
  });
});
