import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Admin from "@/pages/Admin";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("staff page authorization", () => {
  it("hides admin controls from an authenticated trader", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "is_staff" ? false : false, error: null }));
    render(<Admin />);
    expect(await screen.findByText("Staff access required")).toBeInTheDocument();
    expect(screen.queryByText("System controls")).not.toBeInTheDocument();
  });
});
