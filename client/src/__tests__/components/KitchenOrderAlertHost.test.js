import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KitchenOrderAlertHost from "@/components/KitchenOrderAlertHost";

const mockUseAuth = jest.fn();
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/menu",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, onClick, className, ...props }) => (
      <div onClick={onClick} className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

class MockEventSource {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.readyState = 1;
    MockEventSource.instances.push(this);
  }
  addEventListener(type, cb) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(cb);
  }
  close() {
    this.readyState = 2;
    this.closed = true;
  }
  emit(type, data) {
    (this.listeners[type] || []).forEach((cb) =>
      cb({ data: JSON.stringify(data) }),
    );
  }
}

const sampleOrder = {
  _id: "abc12345orderid",
  customer: { name: "Jane Doe", phone: "555-0100", email: "jane@example.com" },
  items: [{ quantity: 1, name: "Latte", modifiers: [] }],
  totals: { total: 4.7 },
};

describe("KitchenOrderAlertHost", () => {
  const originalEventSource = global.EventSource;

  beforeEach(() => {
    MockEventSource.instances = [];
    global.EventSource = MockEventSource;
    window.localStorage.setItem("token", "test-token");
    window.localStorage.setItem("kitchen-audio-enabled", "false");
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
    window.localStorage.clear();
  });

  it("does not connect when the signed-in user is not a kitchen admin", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "customer@example.com" },
      loading: false,
    });
    render(<KitchenOrderAlertHost />);
    expect(MockEventSource.instances).toHaveLength(0);
    expect(screen.queryByText("New order")).not.toBeInTheDocument();
  });

  it("shows the new-order modal on a non-kitchen page when SSE fires", async () => {
    mockUseAuth.mockReturnValue({
      user: { email: "info@wildbeancoffeeshop.com" },
      loading: false,
    });
    render(<KitchenOrderAlertHost />);

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain("/api/orders/kitchen/stream");

    await act(async () => {
      MockEventSource.instances[0].emit("order:created", sampleOrder);
    });

    expect(screen.getByText("New order")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/1x Latte/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Kitchen Dashboard" })).toBeInTheDocument();
  });

  it("still alerts from a window event while away from the dashboard", async () => {
    mockUseAuth.mockReturnValue({
      user: { email: "danielwoldehana@yahoo.com" },
      loading: false,
    });
    render(<KitchenOrderAlertHost />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("kitchen-order-created", { detail: sampleOrder }),
      );
    });

    expect(screen.getByText("New order")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Got it — stop alarm" }));
    expect(screen.queryByText("New order")).not.toBeInTheDocument();
  });
});
