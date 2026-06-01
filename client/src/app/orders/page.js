"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/lib/api";
import { formatStoreDateTime } from "@/lib/dateTime";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorDisplay from "@/components/ErrorDisplay";
import PickupArrivalNotice from "@/components/PickupArrivalNotice";

function OrdersPageContent() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect to auth if not signed in
    if (!authLoading && !user) {
      router.push("/auth");
      return;
    }

    // Fetch orders if user is authenticated
    if (user) {
      fetchOrders();
    }
  }, [user, authLoading, router]);

  // Scroll to specific order if orderId is in URL
  useEffect(() => {
    const orderId = searchParams?.get("orderId");
    if (orderId && orders.length > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`order-${orderId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          // Highlight the order briefly
          element.classList.add("ring-4", "ring-[var(--lime-green)]", "ring-opacity-50");
          setTimeout(() => {
            element.classList.remove("ring-4", "ring-[var(--lime-green)]", "ring-opacity-50");
          }, 2000);
        }
      }, 100);
    }
  }, [orders, searchParams]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const userOrders = await authApi.getUserOrders();
      setOrders(userOrders);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) =>
    formatStoreDateTime(dateString, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Get customer-friendly status display
  const getCustomerStatus = (status) => {
    // "placed" should not be shown - show "In Progress" instead
    if (status === "placed" || status === "preparing") {
      return "In Progress";
    }
    if (status === "ready") {
      return "Ready for pick up";
    }
    // For other statuses, capitalize first letter
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status) => {
    // Map internal status to display status for colors
    const displayStatus = status === "placed" || status === "preparing" ? "preparing" : status;
    const colors = {
      preparing: "bg-yellow-100 text-yellow-800",
      ready: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[displayStatus] || "bg-gray-100 text-gray-800";
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading your orders..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--coffee-brown-very-light)] to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold text-[var(--coffee-brown)]">
          Your Orders
        </h1>

        {orders.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-md">
            <p className="text-lg text-gray-600">You haven't placed any orders yet.</p>
            <a
              href="/order"
              className="mt-4 inline-block rounded-full bg-[var(--lime-green)] px-6 py-2 text-white font-semibold transition-all hover:bg-[var(--lime-green-dark)]"
            >
              Place Your First Order
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <PickupArrivalNotice className="mb-2" />
            {orders.map((order) => (
              <div
                id={`order-${order._id}`}
                key={order._id}
                className="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--coffee-brown)]">
                      Order #{order._id.slice(-8).toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-600">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="mt-2 sm:mt-0 flex items-center gap-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getCustomerStatus(order.status)}
                    </span>
                    <span className="text-lg font-bold text-[var(--coffee-brown)]">
                      ${order.totals.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="mb-2 text-sm font-semibold text-[var(--coffee-brown)]">
                    Items:
                  </h4>
                  <ul className="space-y-2">
                    {order.items.map((item, index) => (
                      <li key={index} className="flex justify-between text-sm">
                        <span>
                          {item.name} x{item.quantity}
                        </span>
                        <span className="text-gray-600">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {order.pickupTime && (
                  <div className="mt-4 text-sm text-gray-600">
                    <strong>Pickup Time:</strong> {formatDate(order.pickupTime)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--lime-green)] border-r-transparent"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
