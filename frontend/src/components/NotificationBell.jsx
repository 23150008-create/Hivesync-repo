import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  Bell,
  CheckCheck,
  Package,
  Truck,
  ShoppingCart,
  Users,
  Settings,
  X,
  Eye,
  CalendarClock,
  Hash,
  CreditCard,
  FileText,
  ArrowRight,
  ArrowLeft,
  Handshake,
  List,
} from "lucide-react";

import "../styles/notifications.css";
import API_BASE from "../config/api";

const TYPE_DESTINATIONS = {
  Inventory: {
    page: "inventory",
    label: "Inventory",
  },

  Expiration: {
    page: "inventory",
    label: "Inventory",
  },

  Pullout: {
    page: "vendors",
    label: "Product Actions",
  },

  "Pull-out": {
    page: "vendors",
    label: "Product Actions",
  },

  Disposal: {
    page: "vendors",
    label: "Product Actions",
  },

  Delivery: {
    page: "deliveries",
    label: "Deliveries",
  },

  POS: {
    page: "pos",
    label: "Point of Sale",
  },

  Sale: {
    page: "pos",
    label: "Point of Sale",
  },

  Return: {
    page: "pos",
    label: "Point of Sale",
  },

  User: {
    page: "users",
    label: "User Management",
  },

  Supplier: {
    page: "vendors",
    label: "Supplier Management",
  },

  "Supplier Product Request": {
    page: "vendors",
    label: "Product Proposals",
  },

  "Supplier Product": {
    page: "vendors",
    label: "Product Proposals",
  },

  "Product Request": {
    page: "vendors",
    label: "Product Proposals",
  },

  Vendor: {
    page: "vendors",
    label: "Supplier Management",
  },

  Payment: {
    page: "vendors",
    label: "Supplier Management",
  },

  Remittance: {
    page: "vendors",
    label: "Supplier Management",
  },

  Receivable: {
    page: "reports",
    label: "Reports",
  },

  Receivables: {
    page: "reports",
    label: "Reports",
  },

  Consignment: {
    page: "vendors",
    label: "Supplier Management",
  },

  Report: {
    page: "reports",
    label: "Reports",
  },

  Audit: {
    page: "settings",
    label: "Utilities",
  },

  System: {
    page: "dashboard",
    label: "Dashboard",
  },
};

function NotificationBell({
  user = null,
  onNavigate = null,
}) {
  const [open, setOpen] =
    useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [
    selectedNotification,
    setSelectedNotification,
  ] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [markingAll, setMarkingAll] =
    useState(false);

  const [
    deletingNotificationId,
    setDeletingNotificationId,
  ] = useState(null);

  const dropdownRef = useRef(null);

  
  const notificationRequestRef =
    useRef(null);

  const supplierStartupNotificationShownRef =
    useRef(false);

  const getSavedUser = () => {
    try {
      const hivesyncUser =
        localStorage.getItem(
          "hivesync_user"
        );

      const oldUser =
        localStorage.getItem("user");

      if (hivesyncUser) {
        return JSON.parse(
          hivesyncUser
        );
      }

      if (oldUser) {
        return JSON.parse(oldUser);
      }

      return null;
    } catch (error) {
      console.error(
        "Unable to read saved notification user:",
        error
      );

      return null;
    }
  };

  useEffect(() => {
    if (!selectedNotification) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedNotification(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [selectedNotification]);

  const activeUser =
    user || getSavedUser() || {};

  const activeRole =
    activeUser?.role || "";

  const isSupplier =
    activeRole === "Supplier" ||
    activeRole === "Vendor";

  const buildNotificationUrl = () => {
    const params =
      new URLSearchParams({
        time: Date.now().toString(),
        role: activeRole,
        user_id:
          activeUser?.user_id || "",
        full_name:
          activeUser?.full_name ||
          activeUser?.name ||
          "",
        email:
          activeUser?.email || "",
      });

    return `${API_BASE}/notifications/get_notifications.php?${params.toString()}`;
  };

  const loadNotifications =
    async ({ silent = false } = {}) => {
      
      if (notificationRequestRef.current) {
        return notificationRequestRef.current;
      }

      if (!silent) {
        setLoading(true);
      }

      const request = (async () => {
        try {
          const response = await fetch(
            buildNotificationUrl(),
            {
              credentials: "include",
              cache: "no-store",
            }
          );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data?.success
          ) {
            throw new Error(
              data?.message ||
                "Unable to load notifications."
            );
          }

          setNotifications(
            data.notifications || []
          );

          setUnreadCount(
            Number(
              data.unread_count || 0
            )
          );

          if (
            isSupplier &&
            !supplierStartupNotificationShownRef.current
          ) {
            const firstUnreadNotification =
              (data.notifications || []).find(
                (item) =>
                  Number(item?.is_read || 0) === 0
              );

            supplierStartupNotificationShownRef.current =
              true;

            if (firstUnreadNotification) {
              setSelectedNotification(
                firstUnreadNotification
              );
              setOpen(false);
            }
          }
        } catch (error) {
          console.error(
            "Notification fetch error:",
            error
          );

          setNotifications([]);
          setUnreadCount(0);
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      })();

      notificationRequestRef.current =
        request;

      try {
        await request;
      } finally {
        if (
          notificationRequestRef.current ===
          request
        ) {
          notificationRequestRef.current =
            null;
        }
      }

      return request;
    };

  useEffect(() => {
    supplierStartupNotificationShownRef.current =
      false;

    loadNotifications();

    const interval =
      window.setInterval(() => {
        
        if (!document.hidden) {
          loadNotifications({
            silent: true,
          });
        }
      }, 15000);

    const handleVisibilityChange =
      () => {
        if (!document.hidden) {
          loadNotifications({
            silent: true,
          });
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    activeUser?.user_id,
    activeUser?.email,
    activeUser?.full_name,
    activeRole,
  ]);

  useEffect(() => {
    const handleClickOutside = (
      event
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const isSupplierProductActionNotification = (
    notification
  ) => {
    const explicitType = String(
      notification?.type || ""
    )
      .trim()
      .toLowerCase();

    const explicitModule = String(
      notification?.module ||
        notification?.target_page ||
        ""
    )
      .trim()
      .toLowerCase();

    const referenceCode = String(
      notification?.reference_code || ""
    )
      .trim()
      .toLowerCase();

    const referenceType = String(
      notification?.reference_type || ""
    )
      .trim()
      .toLowerCase();

    const title = String(
      notification?.title || ""
    )
      .trim()
      .toLowerCase();

    const message = String(
      notification?.message || ""
    )
      .trim()
      .toLowerCase();

    

    const hasStructuredActionReference =
      explicitType === "pullout" ||
      explicitType === "pull-out" ||
      explicitType === "disposal" ||
      referenceCode.startsWith("par-") ||
      referenceType.includes("product_action") ||
      referenceType.includes("product action");

    const hasSupplierRequestTitle =
      (
        title.includes("supplier") ||
        title.includes("vendor")
      ) &&
      (
        title.includes("pull-out request") ||
        title.includes("pullout request") ||
        title.includes("disposal request") ||
        title.includes("product action request")
      );

    const hasSupplierRequestMessage =
      (
        message.includes("supplier") ||
        message.includes("vendor") ||
        message.includes("request")
      ) &&
      (
        message.includes("pull-out") ||
        message.includes("pullout") ||
        message.includes("disposal") ||
        message.includes("product action")
      );

    if (
      hasStructuredActionReference ||
      hasSupplierRequestTitle ||
      hasSupplierRequestMessage
    ) {
      return true;
    }

    
    if (
      explicitType === "expiration" ||
      explicitType === "inventory" ||
      explicitModule === "inventory"
    ) {
      return false;
    }

    return false;
  };

  const isSupplierProductProposalNotification = (
    notification
  ) => {
    const haystack = [
      notification?.title,
      notification?.message,
      notification?.module,
      notification?.type,
      notification?.target_page,
      notification?.reference_type,
    ]
      .map((value) =>
        String(value || "").toLowerCase()
      )
      .join(" " );

    return (
      haystack.includes(
        "supplier product request"
      ) ||
      haystack.includes(
        "supplier product proposal"
      ) ||
      haystack.includes(
        "product request"
      )
    );
  };

  const getDestination = (
    notification
  ) => {
    

    const targetPage = String(
      notification?.target_page || ""
    ).trim();

    const module = String(
      notification?.module || ""
    ).trim();

    const notificationType = String(
      notification?.type || "System"
    ).trim();

    const normalizedType =
      notificationType.toLowerCase();

    const normalizedModule =
      module.toLowerCase();

    const normalizedTargetPage =
      targetPage.toLowerCase();

    

    if (
      isSupplierProductActionNotification(
        notification
      )
    ) {
      return {
        page: "vendors",
        label: "Review Product Action",
        focusType:
          "supplier_product_action_request",
      };
    }

    const referenceCode = String(
      notification?.reference_code || ""
    )
      .trim()
      .toLowerCase();

    const title = String(
      notification?.title || ""
    )
      .trim()
      .toLowerCase();

    if (
      referenceCode.startsWith("rr-") ||
      title.includes("restock request")
    ) {
      return {
        page: "deliveries",
        label: isSupplier
          ? "My Deliveries"
          : "Deliveries",
        focusType: "restock_request",
      };
    }

    

    if (
      normalizedType === "expiration" ||
      normalizedType === "inventory" ||
      normalizedModule === "inventory" ||
      normalizedTargetPage === "inventory"
    ) {
      return {
        page: "inventory",
        label: "Inventory",
      };
    }

    

    if (
      isSupplierProductProposalNotification(
        notification
      )
    ) {
      return {
        page: "vendors",
        label: "Product Proposals",
        focusType:
          "supplier_product_request",
      };
    }

    

    const directPages = [
      "dashboard",
      "users",
      "inventory",
      "deliveries",
      "vendors",
      "pos",
      "receivables",
      "pricing",
      "reports",
      "settings",
    ];

    const directDestination =
      targetPage || module;

    const lowercaseDestination =
      directDestination.toLowerCase();

    if (
      directPages.includes(
        lowercaseDestination
      )
    ) {
      return {
        page: lowercaseDestination,
        label: getPageLabel(
          lowercaseDestination
        ),
      };
    }

    

    return (
      TYPE_DESTINATIONS[
        notificationType
      ] ||
      TYPE_DESTINATIONS.System
    );
  };

  const markRead = async (
    notificationId
  ) => {
    if (!notificationId) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/notifications/mark_read.php`,
        {
          method: "POST",
          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            notification_id:
              notificationId,
            user_id:
              activeUser?.user_id || "",
            role: activeRole,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to mark notification as read."
        );
      }

      setNotifications(
        (current) =>
          current.map((item) =>
            String(
              item.notification_id
            ) ===
            String(notificationId)
              ? {
                  ...item,
                  is_read: 1,
                }
              : item
          )
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    } catch (error) {
      console.error(
        "Mark read error:",
        error
      );
    }
  };

  const markNotificationRead =
    async (notification) => {
      if (
        Number(
          notification?.is_read
        ) === 0
      ) {
        await markRead(
          notification.notification_id
        );
      }
    };

  

  const unreadNotifications =
    notifications.filter(
      (item) =>
        Number(item?.is_read || 0) === 0
    );

  const selectedNotificationIndex =
    selectedNotification
      ? unreadNotifications.findIndex(
          (item) =>
            String(item.notification_id) ===
            String(
              selectedNotification.notification_id
            )
        )
      : -1;

  const hasPreviousNotification =
    selectedNotificationIndex > 0;

  const hasNextNotification =
    selectedNotificationIndex >= 0 &&
    selectedNotificationIndex <
      unreadNotifications.length - 1;

  const showPreviousNotification = () => {
    if (!hasPreviousNotification) {
      return;
    }

    setSelectedNotification(
      unreadNotifications[
        selectedNotificationIndex - 1
      ]
    );
  };

  const showNextNotification = () => {
    if (!hasNextNotification) {
      return;
    }

    setSelectedNotification(
      unreadNotifications[
        selectedNotificationIndex + 1
      ]
    );
  };

  const getProductActionRequestId = (
    notification
  ) => {
    const referenceId =
      notification?.reference_id;

    if (
      referenceId !== null &&
      referenceId !== undefined &&
      String(referenceId).trim() !== ""
    ) {
      return referenceId;
    }

    
    const referenceCode = String(
      notification?.reference_code || ""
    ).trim();

    return referenceCode || null;
  };

  const handleNotificationClick =
    async (notification) => {
      await markNotificationRead(
        notification
      );

      const destination =
        getDestination(notification);

      setOpen(false);
      setSelectedNotification(null);

      if (
        typeof onNavigate ===
        "function"
      ) {
        onNavigate({
          ...destination,

          notificationId:
            notification.notification_id,

          referenceId:
            destination.focusType === "restock_request"
              ? null
              : notification.reference_id ||
                null,

          vendorId:
            notification.vendor_id ||
            notification.supplier_id ||
            null,

          requestId:
            destination.focusType === "restock_request"
              ? null
              : isSupplierProductActionNotification(
                  notification
                )
              ? getProductActionRequestId(
                  notification
                )
              : isSupplierProductProposalNotification(
                  notification
                )
              ? notification.reference_id ||
                null
              : null,

          focusType:
            destination.focusType ||
            null,

          type:
            notification.type ||
            "System",

          notification,
        });
      }
    };

  

  const openNotificationDetails =
    async (event, notification) => {
      event.stopPropagation();

      await markNotificationRead(
        notification
      );

      setSelectedNotification({
        ...notification,
        is_read: 1,
      });

      setOpen(false);
    };

  const navigateFromDetails =
    async () => {
      if (!selectedNotification) {
        return;
      }

      const destination =
        getDestination(
          selectedNotification
        );

      setSelectedNotification(null);

      if (
        typeof onNavigate ===
        "function"
      ) {
        onNavigate({
          ...destination,

          notificationId:
            selectedNotification.notification_id,

          referenceId:
            destination.focusType === "restock_request"
              ? null
              : selectedNotification.reference_id ||
                null,

          vendorId:
            selectedNotification.vendor_id ||
            selectedNotification.supplier_id ||
            null,

          requestId:
            destination.focusType === "restock_request"
              ? null
              : isSupplierProductActionNotification(
                  selectedNotification
                )
              ? getProductActionRequestId(
                  selectedNotification
                )
              : isSupplierProductProposalNotification(
                  selectedNotification
                )
              ? selectedNotification.reference_id ||
                null
              : null,

          focusType:
            destination.focusType ||
            null,

          type:
            selectedNotification.type ||
            "System",

          notification:
            selectedNotification,
        });
      }
    };

  const markAllRead = async () => {
    if (
      markingAll ||
      unreadCount === 0
    ) {
      return;
    }

    setMarkingAll(true);

    try {
      const response = await fetch(
        `${API_BASE}/notifications/mark_all_read.php`,
        {
          method: "POST",
          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            role: activeRole,

            user_id:
              activeUser?.user_id ||
              "",

            full_name:
              activeUser?.full_name ||
              activeUser?.name ||
              "",

            email:
              activeUser?.email || "",
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to mark all notifications as read."
        );
      }

      setNotifications(
        (current) =>
          current.map((item) => ({
            ...item,
            is_read: 1,
          }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        "Mark all read error:",
        error
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification =
    async (notificationId) => {
      if (
        !notificationId ||
        isSupplier ||
        deletingNotificationId
      ) {
        return false;
      }

      const targetNotification =
        notifications.find(
          (item) =>
            String(item.notification_id) ===
            String(notificationId)
        ) || null;

      setDeletingNotificationId(
        notificationId
      );

      try {
        const response = await fetch(
          `${API_BASE}/notifications/delete_notification.php`,
          {
            method: "POST",
            credentials: "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              notification_id:
                notificationId,

              user_id:
                activeUser?.user_id || "",

              role:
                activeRole || "",
            }),
          }
        );

        let data = null;

        try {
          data = await response.json();
        } catch {
          throw new Error(
            "The notification server returned an invalid response."
          );
        }

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              "Unable to remove notification."
          );
        }

        
        setNotifications((current) =>
          current.filter(
            (item) =>
              String(
                item.notification_id
              ) !==
              String(notificationId)
          )
        );

        if (
          Number(
            targetNotification?.is_read
          ) === 0
        ) {
          setUnreadCount((current) =>
            Math.max(
              0,
              Number(current || 0) - 1
            )
          );
        }

        if (
          String(
            selectedNotification
              ?.notification_id
          ) ===
          String(notificationId)
        ) {
          setSelectedNotification(null);
        }

        return true;
      } catch (error) {
        console.error(
          "Delete notification error:",
          error
        );

        window.alert(
          error?.message ||
            "Unable to remove the notification."
        );

        return false;
      } finally {
        setDeletingNotificationId(null);
      }
    };

  const getIcon = (type) => {
    switch (type) {
      case "Inventory":
      case "Expiration":
      case "Pullout":
      case "Pull-out":
      case "Disposal":
        return <Package size={18} />;

      case "Delivery":
        return <Truck size={18} />;

      case "POS":
      case "Sale":
      case "Return":
        return (
          <ShoppingCart size={18} />
        );

      case "User":
        return <Users size={18} />;

      case "Supplier":
      case "Vendor":
      case "Consignment":
        return (
          <Handshake size={18} />
        );

      case "Payment":
      case "Remittance":
        return (
          <CreditCard size={18} />
        );

      case "Report":
        return <FileText size={18} />;

      default:
        return <Settings size={18} />;
    }
  };

  const formatDate = (
    dateString,
    full = false
  ) => {
    if (!dateString) {
      return "No date available";
    }

    const normalized = String(
      dateString
    ).replace(" ", "T");

    const date =
      new Date(normalized);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateString;
    }

    return date.toLocaleString(
      "en-PH",
      {
        month: full
          ? "long"
          : "short",

        day: "2-digit",

        year: full
          ? "numeric"
          : undefined,

        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  return (
    <>
      <div
        className="notification-wrapper"
        ref={dropdownRef}
      >
        <button
          type="button"
          className="notification-bell-btn"
          onClick={() => {
            setOpen(
              (current) => !current
            );

            loadNotifications();
          }}
          title="Notifications"
          aria-label="Open notifications"
        >
          <Bell size={20} />

          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99
                ? "99+"
                : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="notification-dropdown">
            <div className="notification-header">
              <div>
                <h3>
                  {isSupplier
                    ? "My Notifications"
                    : "Notifications"}
                </h3>

                <p>
                  {unreadCount} unread
                  notification
                  {unreadCount === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              <button
                type="button"
                className="notification-mark-btn"
                onClick={markAllRead}
                disabled={
                  unreadCount === 0 ||
                  notifications.length ===
                    0 ||
                  markingAll
                }
              >
                <CheckCheck size={16} />

                {markingAll
                  ? "Updating..."
                  : "Mark all read"}
              </button>
            </div>

            <div className="notification-list">
              {loading &&
              notifications.length ===
                0 ? (
                <div className="notification-empty">
                  <Bell size={28} />

                  <p>
                    Loading notifications...
                  </p>
                </div>
              ) : notifications.length ===
                0 ? (
                <div className="notification-empty">
                  <Bell size={28} />

                  <p>
                    {isSupplier
                      ? "No notifications for your account."
                      : "No notifications yet."}
                  </p>
                </div>
              ) : (
                notifications.map(
                  (item) => {
                    const destination =
                      getDestination(
                        item
                      );

                    return (
                      <article
                        key={
                          item.notification_id
                        }
                        className={
                          Number(
                            item.is_read
                          ) === 0
                            ? "notification-item unread"
                            : "notification-item"
                        }
                        onClick={() =>
                          handleNotificationClick(
                            item
                          )
                        }
                        role="button"
                        tabIndex={0}
                        title={`Open ${destination.label}`}
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key ===
                              " "
                          ) {
                            event.preventDefault();

                            handleNotificationClick(
                              item
                            );
                          }
                        }}
                      >
                        <div
                          className={`notification-type-icon ${String(
                            item.type ||
                              "System"
                          ).toLowerCase()}`}
                        >
                          {getIcon(
                            item.type
                          )}
                        </div>

                        <div className="notification-content">
                          <div className="notification-title-row">
                            <h4>
                              {item.title}
                            </h4>

                            <div className="notification-row-actions">
                              <button
                                type="button"
                                className="notification-view-button"
                                onClick={(
                                  event
                                ) =>
                                  openNotificationDetails(
                                    event,
                                    item
                                  )
                                }
                                title="View full details"
                                aria-label="View full notification details"
                              >
                                <Eye
                                  size={14}
                                />
                              </button>

                              {!isSupplier && (
                                <button
                                  type="button"
                                  className="notification-delete"
                                  disabled={
                                    String(
                                      deletingNotificationId
                                    ) ===
                                    String(
                                      item.notification_id
                                    )
                                  }
                                  onMouseDown={(
                                    event
                                  ) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                  }}
                                  onClick={async (
                                    event
                                  ) => {
                                    event.preventDefault();
                                    event.stopPropagation();

                                    await deleteNotification(
                                      item.notification_id
                                    );
                                  }}
                                  title="Remove notification"
                                  aria-label="Remove notification"
                                >
                                  <X
                                    size={14}
                                  />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="notification-preview-message">
                            {item.message}
                          </p>

                          <div className="notification-meta">
                            <span>
                              {item.type}
                            </span>

                            <span>
                              {formatDate(
                                item.created_at
                              )}
                            </span>
                          </div>

                          <div className="notification-view-hint">
                            <ArrowRight
                              size={13}
                            />

                            Open{" "}
                            {
                              destination.label
                            }
                          </div>
                        </div>
                      </article>
                    );
                  }
                )
              )}
            </div>
          </div>
        )}
      </div>

      {selectedNotification &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="notification-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedNotification(
                null
              );
            }
          }}
        >
          <section
            className="notification-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-details-title"
          >
            <header className="notification-details-header">
              <div className="notification-details-heading">
                <div
                  className={`notification-details-icon ${String(
                    selectedNotification.type ||
                      "System"
                  ).toLowerCase()}`}
                >
                  {getIcon(
                    selectedNotification.type
                  )}
                </div>

                <div>
                  <span>
                    {selectedNotification.type ||
                      "System"}{" "}
                    Notification
                  </span>

                  <h2 id="notification-details-title">
                    {
                      selectedNotification.title
                    }
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="notification-modal-close"
                onClick={() =>
                  setSelectedNotification(
                    null
                  )
                }
                aria-label="Close notification details"
              >
                <X size={21} />
              </button>
            </header>

            <div className="notification-details-body">
              <div className="notification-detail-message">
                <span>
                  Complete Message
                </span>

                <p>
                  {
                    selectedNotification.message
                  }
                </p>
              </div>

              <div className="notification-detail-grid">
                <div>
                  <CalendarClock
                    size={17}
                  />

                  <span>
                    Date and Time
                  </span>

                  <strong>
                    {formatDate(
                      selectedNotification.created_at,
                      true
                    )}
                  </strong>
                </div>

                <div>
                  <Hash size={17} />

                  <span>
                    Reference ID
                  </span>

                  <strong>
                    {selectedNotification.reference_id ||
                      "No linked reference"}
                  </strong>
                </div>

                <div>
                  <Settings size={17} />

                  <span>
                    Destination
                  </span>

                  <strong>
                    {
                      getDestination(
                        selectedNotification
                      ).label
                    }
                  </strong>
                </div>

                <div>
                  <CheckCheck
                    size={17}
                  />

                  <span>Status</span>
                  <strong>
                    {Number(
                      selectedNotification.is_read || 0
                    ) === 0
                      ? "Unread"
                      : "Read"}
                  </strong>
                </div>
              </div>

              {selectedNotification.details && (
                <div className="notification-additional-details">
                  <div className="notification-additional-heading">
                    <List size={17} />
                    <span>Additional Details</span>
                  </div>

                  <div className="notification-details-table">
                    {parseNotificationDetails(
                      selectedNotification.details
                    ).map((item, index) => (
                      <div
                        className="notification-details-table-row"
                        key={`${item.label}-${index}`}
                      >
                        <span className="notification-details-table-label">
                          {item.label}
                        </span>

                        <strong className="notification-details-table-value">
                          {item.value || "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer className="notification-details-actions">
              <div className="notification-modal-navigation">
                <button
                  type="button"
                  className="notification-close-button"
                  onClick={showPreviousNotification}
                  disabled={!hasPreviousNotification}
                >
                  <ArrowLeft size={16} />
                  Previous
                </button>

                <span className="notification-modal-position">
                  {selectedNotificationIndex >= 0
                    ? `${selectedNotificationIndex + 1} of ${unreadNotifications.length}`
                    : ""}
                </span>

                <button
                  type="button"
                  className="notification-close-button"
                  onClick={showNextNotification}
                  disabled={!hasNextNotification}
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              </div>

              {!isSupplier && (
                <button
                  type="button"
                  className="notification-remove-button"
                  disabled={
                    String(
                      deletingNotificationId
                    ) ===
                    String(
                      selectedNotification.notification_id
                    )
                  }
                  onClick={async () => {
                    await deleteNotification(
                      selectedNotification.notification_id
                    );
                  }}
                >
                  <X size={16} />
                  {String(
                    deletingNotificationId
                  ) ===
                  String(
                    selectedNotification.notification_id
                  )
                    ? "Removing..."
                    : "Remove Notification"}
                </button>
              )}

              <div className="notification-details-right-actions">
                {Number(
                  selectedNotification.is_read || 0
                ) === 0 && (
                  <button
                    type="button"
                    className="notification-close-button"
                    onClick={async () => {
                      await markNotificationRead(
                        selectedNotification
                      );

                      setSelectedNotification(
                        (current) =>
                          current
                            ? {
                                ...current,
                                is_read: 1,
                              }
                            : current
                      );
                    }}
                  >
                    <CheckCheck size={16} />
                    Mark as Read
                  </button>
                )}

                <button
                  type="button"
                  className="notification-close-button"
                  onClick={() =>
                    setSelectedNotification(
                      null
                    )
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  className="notification-open-module-button"
                  onClick={
                    navigateFromDetails
                  }
                >
                  <ArrowRight
                    size={16}
                  />

                  Open{" "}
                  {
                    getDestination(
                      selectedNotification
                    ).label
                  }
                </button>
              </div>
            </footer>
          </section>
        </div>
        ,
        document.body
      )}

    </>
  );
}

function parseNotificationDetails(details) {
  const text = String(details || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return [];
  }

  const labels = [
    "Preferred Delivery Date",
    "Requested Quantity",
    "Remaining Balance",
    "Remaining balance",
    "Total Remittance",
    "Total remittance",
    "Payment Method",
    "Payment method",
    "Payment Date",
    "Payment date",
    "Received By",
    "Received by",
    "Processed By",
    "Processed by",
    "Expiration Date",
    "Expiry Date",
    "Pull-out Date",
    "Disposal Date",
    "Current Stock",
    "Request Number",
    "Request No.",
    "Request No",
    "Payment No.",
    "Payment No",
    "Amount Paid",
    "Amount paid",
    "Remittance",
    "Delivery",
    "Reference",
    "Status",
    "Product",
    "SKU",
    "Requested By",
    "Requested",
    "Remarks",
    "Action",
    "Quantity",
    "Batch No.",
    "Batch No",
    "Batch",
    "Supplier",
    "Reason",
    "Amount",
    "Balance",
  ];

  const escapedLabels = labels
    .sort((a, b) => b.length - a.length)
    .map((label) =>
      label.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )
    )
    .join("|");

  const regex = new RegExp(
    `(${escapedLabels})\\s*:\\s*`,
    "gi"
  );

  const matches = [
    ...text.matchAll(regex),
  ];

  if (matches.length === 0) {
    return [
      {
        label: "Details",
        value: text,
      },
    ];
  }

  return matches.map((match, index) => {
    const valueStart =
      match.index + match[0].length;

    const valueEnd =
      index + 1 < matches.length
        ? matches[index + 1].index
        : text.length;

    return {
      label: match[1].trim(),
      value: text
        .slice(valueStart, valueEnd)
        .trim(),
    };
  });
}

function getPageLabel(page) {
  const labels = {
    dashboard: "Dashboard",
    users: "User Management",
    inventory: "Inventory",
    deliveries: "Deliveries",
    vendors: "Supplier Management",
    pos: "Point of Sale",
    receivables: "Receivables",
    pricing: "Pricing",
    reports: "Reports",
    settings: "Utilities",
  };

  return labels[page] || "Dashboard";
}

export default NotificationBell;