import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Archive,
  X,
  KeyRound,
  Copy,
  CheckCircle,
  AlertTriangle,
  Info,
  LoaderCircle,
} from "lucide-react";

import API_BASE from "../config/api";
import "../styles/userManagement.css";
import {
  ALL_MODULE_IDS,
  MODULE_OPTIONS,
  ROLE_DEFAULT_PERMISSIONS,
  getModuleLabel,
} from "../utils/permissions";


const DEFAULT_PASSWORD = "HiveSync@123";

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [createdCredential, setCreatedCredential] = useState(null);
  const [resetCredential, setResetCredential] = useState(null);

  const [messageModal, setMessageModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);

  const isAdmin =
    user?.role === "Admin" ||
    user?.role === "Staff";

  const emptyAddForm = {
    first_name: "",
    middle_name: "",
    last_name: "",
    position: "",
    position_choice: "",
    custom_position: "",
    email: "",
    role: "Staff",
    vendor_id: "",
    access_mode: "Default",
    module_permissions: [...ROLE_DEFAULT_PERMISSIONS.Staff],
  };

  const emptyEditForm = {
    user_id: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    position: "",
    position_choice: "",
    custom_position: "",
    email: "",
    role: "Staff",
    vendor_id: "",
    access_mode: "Default",
    module_permissions: [...ROLE_DEFAULT_PERMISSIONS.Staff],
  };

  const [formData, setFormData] = useState(emptyAddForm);
  const [editData, setEditData] = useState(emptyEditForm);

  const roleOptions = ["Admin", "Staff", "Supplier", "Audit"];

  const positionOptions = [
    "Administrator",
    "Manager",
    "Cashier",
    "Inventory Staff",
    "Delivery Staff",
    "Audit Staff",
    "Supplier Representative",
    "Others",
  ];

  const permissionsMatchRoleDefault = (
    role,
    permissions
  ) => {
    const defaults = [
      ...(ROLE_DEFAULT_PERMISSIONS[role] || []),
    ].sort();

    const current = [
      ...(Array.isArray(permissions)
        ? permissions
        : []),
    ].sort();

    return (
      defaults.length === current.length &&
      defaults.every(
        (permission, index) =>
          permission === current[index]
      )
    );
  };

  const resolvePositionFields = (
    position
  ) => {
    const cleanPosition = String(
      position || ""
    ).trim();

    if (
      positionOptions.includes(
        cleanPosition
      ) &&
      cleanPosition !== "Others"
    ) {
      return {
        position_choice:
          cleanPosition,
        custom_position: "",
      };
    }

    if (cleanPosition) {
      return {
        position_choice: "Others",
        custom_position:
          cleanPosition,
      };
    }

    return {
      position_choice: "",
      custom_position: "",
    };
  };

  const showMessage = (type, title, message) => {
    setMessageModal({ type, title, message });
  };

  const getCsrfToken = async () => {
    const res = await fetch(
      `${API_BASE}/auth/csrf_token.php`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (
      !res.ok ||
      !data.success ||
      !data.csrf_token
    ) {
      throw new Error(
        data.message ||
          "Unable to verify the security token."
      );
    }

    return data.csrf_token;
  };

  const buildFullName = (data) => {
    return [data.first_name, data.middle_name, data.last_name]
      .filter(Boolean)
      .join(" ");
  };

  const getUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/user_management/get_users.php`, { credentials: "include" });
      const data = await res.json();

      if (data.success) {
        setUsers(data.users || []);
      } else {
        showMessage(
          "error",
          "Load Failed",
          data.message ||
            data.error ||
            "Failed to load users."
        );
      }
    } catch {
      showMessage("error", "Connection Error", "Cannot connect to the backend while loading users.");
    }
  };

  const getSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE}/vendor_management/get_vendors.php`, { credentials: "include" });
      const data = await res.json();

      if (data.success) {
        setSuppliers(
          (data.vendors || []).filter(
            (supplier) =>
              String(supplier.status || "Active") !==
              "Archived"
          )
        );
      } else {
        showMessage(
          "error",
          "Supplier Load Failed",
          data.message ||
            data.error ||
            "Failed to load supplier records."
        );
      }
    } catch {
      showMessage("error", "Connection Error", "Cannot load supplier records.");
    }
  };

  useEffect(() => {
    getUsers();
    getSuppliers();
  }, []);

  const logAction = async (action, details) => {
    try {
      await fetch(`${API_BASE}/audit_trail/log_action.php`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.user_id || null,
          user_name: user?.full_name || "Unknown User",
          module: "User Management",
          action,
          details,
        }),
      });
    } catch {}
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "role") {
      setFormData((current) => ({
        ...current,
        role: value,
        vendor_id:
          value === "Supplier"
            ? current.vendor_id
            : "",
        access_mode:
          value === "Admin"
            ? "Default"
            : current.access_mode,
        module_permissions:
          value === "Admin" ||
          current.access_mode === "Default"
            ? [
                ...(ROLE_DEFAULT_PERMISSIONS[
                  value
                ] || []),
              ]
            : current.module_permissions,
      }));
      return;
    }

    if (name === "access_mode") {
      setFormData((current) => ({
        ...current,
        access_mode: value,
        module_permissions:
          value === "Default"
            ? [
                ...(ROLE_DEFAULT_PERMISSIONS[
                  current.role
                ] || []),
              ]
            : current.module_permissions,
      }));
      return;
    }

    if (name === "position_choice") {
      setFormData((current) => ({
        ...current,
        position_choice: value,
        custom_position:
          value === "Others"
            ? current.custom_position
            : "",
        position:
          value === "Others"
            ? current.custom_position
            : value,
      }));
      return;
    }

    if (name === "custom_position") {
      setFormData((current) => ({
        ...current,
        custom_position: value,
        position: value,
      }));
      return;
    }

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    if (name === "role") {
      setEditData((current) => ({
        ...current,
        role: value,
        vendor_id:
          value === "Supplier"
            ? current.vendor_id
            : "",
        access_mode:
          value === "Admin"
            ? "Default"
            : current.access_mode,
        module_permissions:
          value === "Admin" ||
          current.access_mode === "Default"
            ? [
                ...(ROLE_DEFAULT_PERMISSIONS[
                  value
                ] || []),
              ]
            : current.module_permissions,
      }));
      return;
    }

    if (name === "access_mode") {
      setEditData((current) => ({
        ...current,
        access_mode: value,
        module_permissions:
          value === "Default"
            ? [
                ...(ROLE_DEFAULT_PERMISSIONS[
                  current.role
                ] || []),
              ]
            : current.module_permissions,
      }));
      return;
    }

    if (name === "position_choice") {
      setEditData((current) => ({
        ...current,
        position_choice: value,
        custom_position:
          value === "Others"
            ? current.custom_position
            : "",
        position:
          value === "Others"
            ? current.custom_position
            : value,
      }));
      return;
    }

    if (name === "custom_position") {
      setEditData((current) => ({
        ...current,
        custom_position: value,
        position: value,
      }));
      return;
    }

    setEditData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const togglePermission = (setter, currentData, moduleId) => {
    if (
      currentData.role === "Admin" ||
      currentData.access_mode !== "Custom"
    ) {
      return;
    }

    const currentPermissions = Array.isArray(
      currentData.module_permissions
    )
      ? currentData.module_permissions
      : [];

    setter({
      ...currentData,
      module_permissions: currentPermissions.includes(moduleId)
        ? currentPermissions.filter((permission) => permission !== moduleId)
        : [...currentPermissions, moduleId],
    });
  };

  const selectAllPermissions = (setter, currentData) => {
    if (
      currentData.role === "Admin" ||
      currentData.access_mode !== "Custom"
    ) {
      return;
    }

    setter({
      ...currentData,
      module_permissions: [...ALL_MODULE_IDS],
    });
  };

  const clearPermissions = (setter, currentData) => {
    if (
      currentData.role === "Admin" ||
      currentData.access_mode !== "Custom"
    ) {
      return;
    }

    setter({
      ...currentData,
      module_permissions: [],
    });
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setFormData(emptyAddForm);
  };

  const openEditModal = (selectedUserData) => {
    if (!isAdmin) {
      showMessage("error", "Access Denied", "You do not have permission to edit users.");
      return;
    }

    const normalizedRole =
      selectedUserData.role === "Vendor"
        ? "Supplier"
        : selectedUserData.role || "Staff";

    const currentPermissions =
      normalizedRole === "Admin"
        ? [...ALL_MODULE_IDS]
        : Array.isArray(
            selectedUserData.module_permissions
          )
          ? selectedUserData.module_permissions
          : [
              ...(ROLE_DEFAULT_PERMISSIONS[
                normalizedRole
              ] || []),
            ];

    const storedAccessMode =
      String(
        selectedUserData.access_mode ||
          ""
      ).trim();

    const inferredAccessMode =
      normalizedRole === "Admin"
        ? "Default"
        : storedAccessMode === "Custom"
          ? "Custom"
          : storedAccessMode === "Default"
            ? "Default"
            : permissionsMatchRoleDefault(
                normalizedRole,
                currentPermissions
              )
              ? "Default"
              : "Custom";

    const positionFields =
      resolvePositionFields(
        selectedUserData.position
      );

    setEditData({
      user_id:
        selectedUserData.user_id || "",
      first_name:
        selectedUserData.first_name || "",
      middle_name:
        selectedUserData.middle_name || "",
      last_name:
        selectedUserData.last_name || "",
      position:
        selectedUserData.position || "",
      ...positionFields,
      email:
        selectedUserData.email || "",
      role: normalizedRole,
      vendor_id:
        selectedUserData.vendor_id || "",
      access_mode:
        inferredAccessMode,
      module_permissions:
        inferredAccessMode === "Default"
          ? [
              ...(ROLE_DEFAULT_PERMISSIONS[
                normalizedRole
              ] || []),
            ]
          : currentPermissions,
    });

    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditData(emptyEditForm);
  };

  const validateUserForm = (data) => {
    if (!data.first_name.trim()) {
      showMessage("error", "Missing First Name", "First name is required.");
      return false;
    }

    if (!data.last_name.trim()) {
      showMessage("error", "Missing Last Name", "Last name is required.");
      return false;
    }

    if (!data.position_choice) {
      showMessage(
        "error",
        "Missing Position",
        "Select a position."
      );
      return false;
    }

    if (
      data.position_choice === "Others" &&
      !String(
        data.custom_position || ""
      ).trim()
    ) {
      showMessage(
        "error",
        "Specify Position",
        "Enter the custom position for this user."
      );
      return false;
    }

    if (!String(data.position || "").trim()) {
      showMessage(
        "error",
        "Missing Position",
        "Position is required."
      );
      return false;
    }

    if (!data.email.trim()) {
      showMessage("error", "Missing Email", "Email is required.");
      return false;
    }

    if (data.role === "Supplier" && !data.vendor_id) {
      showMessage("error", "Missing Supplier", "Please select a supplier for this supplier account.");
      return false;
    }

    if (
      data.role !== "Admin" &&
      data.access_mode === "Custom" &&
      (!Array.isArray(data.module_permissions) ||
        data.module_permissions.length === 0)
    ) {
      showMessage(
        "error",
        "Module Access Required",
        "Select at least one module that this user can access."
      );
      return false;
    }

    return true;
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showMessage("success", "Copied", "Password copied successfully.");
    } catch {
      showMessage("error", "Copy Failed", "Please copy the password manually.");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      showMessage("error", "Access Denied", "You do not have permission to add users.");
      return;
    }

    if (!validateUserForm(formData) || creatingUser) return;

    const fullName = buildFullName(formData);

    setCreatingUser(true);

    try {
      const csrfToken = await getCsrfToken();

      const res = await fetch(`${API_BASE}/user_management/add_user.php`, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          ...formData,
          full_name: fullName,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await logAction(
          "Add User",
          `${user?.full_name || "Admin"} created user account for ${fullName}`
        );

        setCreatedCredential({
          full_name: fullName,
          email: formData.email,
          role: formData.role,
          position: formData.position,
          default_password: data.default_password || DEFAULT_PASSWORD,
          email_sent: data.email_sent,
          email_result: data.email_result,
        });

        closeAddModal();
        getUsers();
      } else {
        showMessage(
          "error",
          "Create User Failed",
          data.message ||
            data.error ||
            "Failed to add user."
        );
      }
    } catch {
      showMessage("error", "Connection Error", "Cannot connect to backend while creating user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      showMessage("error", "Access Denied", "You do not have permission to update users.");
      return;
    }

    if (!validateUserForm(editData)) return;

    const fullName = buildFullName(editData);

    try {
      const csrfToken = await getCsrfToken();

      const res = await fetch(`${API_BASE}/user_management/update_user.php`, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          ...editData,
          full_name: fullName,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await logAction(
          "Update User",
          `${user?.full_name || "Admin"} updated user account for ${fullName}`
        );

        closeEditModal();
        getUsers();
        showMessage("success", "User Updated", "User account was updated successfully.");
      } else {
        showMessage(
          "error",
          "Update Failed",
          data.message ||
            data.error ||
            "Failed to update user."
        );
      }
    } catch {
      showMessage("error", "Connection Error", "Cannot connect to backend while updating user.");
    }
  };

  const requestArchiveUser = (selectedUserData) => {
    if (!isAdmin) {
      showMessage("error", "Access Denied", "You do not have permission to archive users.");
      return;
    }

    if (String(selectedUserData.status || "").toLowerCase() !== "active") {
      showMessage("info", "Already Inactive", "This user account is already inactive.");
      return;
    }

    setConfirmModal({
      type: "danger",
      title: "Archive User",
      message: `Are you sure you want to archive ${selectedUserData.full_name}? This account will no longer appear as active.`,
      confirmLabel: "Archive User",
      onConfirm: () => handleArchiveUser(selectedUserData),
    });
  };

  const handleArchiveUser = async (selectedUserData) => {
    setConfirmModal(null);

    try {
      const csrfToken = await getCsrfToken();

      const res = await fetch(`${API_BASE}/user_management/archive_user.php`, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ user_id: selectedUserData.user_id }),
      });

      const data = await res.json();

      if (data.success) {
        await logAction(
          "Archive User",
          `${user?.full_name || "Admin"} archived user account for ${selectedUserData.full_name}`
        );

        getUsers();
        showMessage("success", "User Archived", "User archived successfully.");
      } else {
        showMessage("error", "Archive Failed", data.message || "Failed to archive user.");
      }
    } catch {
      showMessage("error", "Connection Error", "Cannot connect to backend while archiving user.");
    }
  };

  const requestResetPassword = (selectedUserData) => {
    if (!isAdmin) {
      showMessage("error", "Access Denied", "You do not have permission to reset passwords.");
      return;
    }

    setConfirmModal({
      type: "warning",
      title: "Reset User Password",
      message: `Reset password for ${selectedUserData.full_name}? A new secure temporary password will be generated, and the user will be required to change it on next login.`,
      confirmLabel: "Reset Password",
      onConfirm: () => handleResetPassword(selectedUserData),
    });
  };

  const handleResetPassword = async (selectedUserData) => {
    setConfirmModal(null);

    try {
      const csrfToken = await getCsrfToken();

      const res = await fetch(`${API_BASE}/user_management/reset_password.php`, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ user_id: selectedUserData.user_id }),
      });

      const data = await res.json();

      if (data.success) {
        await logAction(
          "Reset Password",
          `${user?.full_name || "Admin"} reset password for ${selectedUserData.full_name}`
        );

        setResetCredential({
          full_name: selectedUserData.full_name,
          email: selectedUserData.email,
          role:
            selectedUserData.role === "Vendor"
              ? "Supplier"
              : selectedUserData.role,
          position: selectedUserData.position || "N/A",
          default_password: data.default_password || "",
          email_sent: data.email_sent,
          email_result: data.email_result,
        });

        getUsers();
      } else {
        showMessage("error", "Reset Failed", data.message || "Failed to reset password.");
      }
    } catch {
      showMessage("error", "Connection Error", "Cannot connect to backend while resetting password.");
    }
  };

  const filteredUsers = users.filter((item) => {
    const isActive =
      String(item.status || "").trim().toLowerCase() === "active";

    if (!isActive) {
      return false;
    }

    return `${item.full_name} ${item.first_name || ""} ${item.middle_name || ""} ${
      item.last_name || ""
    } ${item.position || ""} ${item.email} ${item.role} ${item.status} ${
      item.vendor_name || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const getPasswordStatus = (item) => {
    return Number(item.must_change_password) === 1 ? "Must Change" : "Updated";
  };

  const displayRole = (role) => {
    return role === "Vendor" ? "Supplier" : role;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <span>{filteredUsers.length} registered user/s</span>
        </div>

        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            Add User
          </button>
        )}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Search users by name, position, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>Role</th>
              <th>Password Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-row">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((item) => (
                <tr key={item.user_id}>
                  <td>{item.full_name}</td>
                  <td>{item.position || "N/A"}</td>
                  <td>
                    <span className="badge gold">{displayRole(item.role)}</span>
                  </td>
                  <td>
                    <span
                      className={
                        Number(item.must_change_password) === 1
                          ? "badge warning"
                          : "badge success"
                      }
                    >
                      {getPasswordStatus(item)}
                    </span>
                  </td>
                  <td>{item.last_login || "Not logged in yet"}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setSelectedUser(item)}
                      title="View User"
                    >
                      <Eye size={17} />
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => openEditModal(item)}
                          title="Edit User"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => requestResetPassword(item)}
                          title="Reset Password"
                        >
                          <KeyRound size={17} />
                        </button>

                        {String(item.status || "").trim().toLowerCase() === "active" && (
                          <button
                            type="button"
                            className="icon-btn danger-icon"
                            onClick={() => requestArchiveUser(item)}
                            title="Archive User"
                          >
                            <Archive size={17} />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && isAdmin && (
        <UserFormModal
          title="Add New User"
          data={formData}
          suppliers={suppliers}
          roleOptions={roleOptions}
          positionOptions={positionOptions}
          onChange={handleChange}
          onClose={closeAddModal}
          onSubmit={handleAddUser}
          submitLabel="Create User"
          submitting={creatingUser}
          copyText={copyText}
          onTogglePermission={(moduleId) =>
            togglePermission(setFormData, formData, moduleId)
          }
          onSelectAllPermissions={() =>
            selectAllPermissions(setFormData, formData)
          }
          onClearPermissions={() =>
            clearPermissions(setFormData, formData)
          }
        />
      )}

      {showEditModal && isAdmin && (
        <UserFormModal
          title="Edit User"
          data={editData}
          suppliers={suppliers}
          roleOptions={roleOptions}
          positionOptions={positionOptions}
          onChange={handleEditChange}
          onClose={closeEditModal}
          onSubmit={handleUpdateUser}
          submitLabel="Update User"
          isEdit
          copyText={copyText}
          onTogglePermission={(moduleId) =>
            togglePermission(setEditData, editData, moduleId)
          }
          onSelectAllPermissions={() =>
            selectAllPermissions(setEditData, editData)
          }
          onClearPermissions={() =>
            clearPermissions(setEditData, editData)
          }
        />
      )}

      {selectedUser && (
        <UserDetailsModal
          selectedUser={selectedUser}
          displayRole={displayRole}
          getPasswordStatus={getPasswordStatus}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {createdCredential && (
        <CredentialModal
          title="User Created Successfully"
          credential={createdCredential}
          onClose={() => setCreatedCredential(null)}
          copyText={copyText}
        />
      )}

      {resetCredential && (
        <CredentialModal
          title="Password Reset Successfully"
          credential={resetCredential}
          onClose={() => setResetCredential(null)}
          copyText={copyText}
        />
      )}

      {messageModal && (
        <MessageModal
          type={messageModal.type}
          title={messageModal.title}
          message={messageModal.message}
          onClose={() => setMessageModal(null)}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          type={confirmModal.type}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onCancel={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
        />
      )}
    </div>
  );
}

function UserFormModal({
  title,
  data,
  suppliers,
  roleOptions,
  positionOptions,
  onChange,
  onClose,
  onSubmit,
  submitLabel,
  isEdit = false,
  submitting = false,
  copyText,
  onTogglePermission,
  onSelectAllPermissions,
  onClearPermissions,
}) {
  const isAdminRole = data.role === "Admin";

  return (
    <div className="user-modal-overlay">
      <div className="user-modal-box user-form-modal">
        <div className="user-modal-header">
          <div>
            <h2>{title}</h2>
            <p>
              Enter the account information and assign only the modules
              this user is allowed to access.
            </p>
          </div>

          <button
            type="button"
            className="user-modal-close"
            onClick={onClose}
            aria-label="Close user form"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="user-form-grid">
            <div className="user-field">
              <label>First Name</label>
              <input
                name="first_name"
                value={data.first_name}
                onChange={onChange}
                placeholder="Enter first name"
                required
              />
            </div>

            <div className="user-field">
              <label>Middle Name</label>
              <input
                name="middle_name"
                value={data.middle_name}
                onChange={onChange}
                placeholder="Enter middle name"
              />
            </div>

            <div className="user-field">
              <label>Last Name</label>
              <input
                name="last_name"
                value={data.last_name}
                onChange={onChange}
                placeholder="Enter last name"
                required
              />
            </div>

            <div className="user-field">
              <label>Position</label>
              <select
                name="position_choice"
                value={data.position_choice || ""}
                onChange={onChange}
                required
              >
                <option value="">
                  Select position
                </option>

                {positionOptions.map(
                  (position) => (
                    <option
                      key={position}
                      value={position}
                    >
                      {position}
                    </option>
                  )
                )}
              </select>
            </div>

            {data.position_choice === "Others" && (
              <div className="user-field">
                <label>
                  Please Specify Position
                </label>
                <input
                  name="custom_position"
                  value={
                    data.custom_position || ""
                  }
                  onChange={onChange}
                  placeholder="Example: Sales Clerk"
                  required
                />
              </div>
            )}

            <div className="user-field user-field-full">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={data.email}
                onChange={onChange}
                placeholder="Enter email"
                required
              />
            </div>

            {!isEdit && (
              <div className="temporary-password-card user-field-full">
                <div>
                  <span>Default Temporary Password</span>
                  <strong>{DEFAULT_PASSWORD}</strong>
                  <p>
                    The user will be required to change this password on
                    first login.
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => copyText(DEFAULT_PASSWORD)}
                  title="Copy Password"
                >
                  <Copy size={16} />
                </button>
              </div>
            )}

            <div className="user-field">
              <label>Role</label>
              <select
                name="role"
                value={data.role}
                onChange={onChange}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {data.role !== "Admin" && (
              <div className="user-field">
                <label>Access Configuration</label>
                <select
                  name="access_mode"
                  value={
                    data.access_mode ||
                    "Default"
                  }
                  onChange={onChange}
                >
                  <option value="Default">
                    Use {data.role} Default Access
                  </option>
                  <option value="Custom">
                    Customize Access
                  </option>
                </select>
              </div>
            )}

            {data.role === "Supplier" && (
              <div className="user-field">
                <label>Assigned Supplier</label>
                <select
                  name="vendor_id"
                  value={data.vendor_id}
                  onChange={onChange}
                  required
                >
                  <option value="">Select supplier</option>

                  {suppliers.map((supplier) => (
                    <option
                      key={supplier.vendor_id}
                      value={supplier.vendor_id}
                    >
                      {supplier.vendor_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <section className="user-permission-section">
            <div className="user-permission-heading">
              <div>
                <span className="user-section-kicker">Access Control</span>
                <h3>Module Permissions</h3>
                <p>
                  Use the role defaults or customize exactly which modules this account can see and open.
                </p>
              </div>

              {!isAdminRole &&
                data.access_mode === "Custom" && (
                <div className="user-permission-tools">
                  <button
                    type="button"
                    onClick={onSelectAllPermissions}
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={onClearPermissions}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {isAdminRole ? (
              <div className="admin-access-notice">
                <CheckCircle size={22} />

                <div>
                  <strong>Complete Administrator Access</strong>
                  <p>
                    Admin accounts automatically receive access to every
                    module. These permissions cannot be removed.
                  </p>
                </div>
              </div>
            ) : data.access_mode !== "Custom" ? (
              <div className="role-default-access-notice">
                <Info size={21} />

                <div>
                  <strong>
                    {data.role} Default Access
                  </strong>
                  <p>
                    This account will automatically use the standard module access for the selected role. Choose Customize Access above to assign specific modules.
                  </p>

                  <div className="role-default-module-list">
                    {(
                      ROLE_DEFAULT_PERMISSIONS[
                        data.role
                      ] || []
                    ).map((permission) => (
                      <span key={permission}>
                        {getModuleLabel(
                          permission
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="user-permission-grid">
                {MODULE_OPTIONS.map((module) => {
                  const checked = (
                    data.module_permissions || []
                  ).includes(module.id);

                  return (
                    <label
                      className={`user-permission-card ${
                        checked ? "selected" : ""
                      }`}
                      key={module.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onTogglePermission(module.id)
                        }
                      />

                      <span className="user-permission-check">
                        {checked ? "✓" : ""}
                      </span>

                      <span className="user-permission-copy">
                        <strong>{module.label}</strong>
                        <small>{module.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {isEdit && (
            <div className="user-edit-note">
              User status is controlled through the Archive button.
              Password changes are handled through Reset Password.
            </div>
          )}

          <div className="user-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary user-submit-btn"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle size={17} className="user-submit-spinner" />
                  Creating User...
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserDetailsModal({ selectedUser, displayRole, getPasswordStatus, onClose }) {
  const accessLabel =
    selectedUser.role === "Admin"
      ? "Complete Administrator Access"
      : selectedUser.access_mode === "Custom"
        ? "Customized Access"
        : "Role Default Access";

  const modulePermissions = Array.isArray(selectedUser.module_permissions)
    ? selectedUser.module_permissions
    : [];

  const initials = String(selectedUser.full_name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const roleLabel = displayRole(selectedUser.role);

  return (
    <div className="user-modal-overlay">
      <div className="user-modal-box user-details-modal user-details-modal-v2">
        <div className="user-modal-header user-details-header-v2">
          <div>
            <h2>User Details</h2>
            <p>Review the account profile, permissions, and activity.</p>
          </div>

          <button
            type="button"
            className="user-modal-close"
            onClick={onClose}
            aria-label="Close user details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="user-details-body-v2">
          <section className="user-profile-hero-v2">
            <div className="user-avatar-v2">{initials || "U"}</div>

            <div className="user-profile-copy-v2">
              <div className="user-profile-title-v2">
                <h3>{selectedUser.full_name}</h3>
                <span>{roleLabel}</span>
              </div>

              <p>{selectedUser.position || "No position specified"}</p>
              <small>{selectedUser.email || "No email available"}</small>
            </div>

            <div className="user-profile-status-v2">
              <span className="user-status-dot-v2" />
              {selectedUser.status || "N/A"}
            </div>
          </section>

          <section className="user-panel-v2">
            <div className="user-panel-heading-v2">
              <div>
                <span>PROFILE</span>
                <h3>Account Information</h3>
              </div>
            </div>

            <div className="user-info-grid-v2">
              <div className="user-info-box-v2">
                <span>Name</span>
                <strong>{selectedUser.full_name}</strong>
              </div>

              <div className="user-info-box-v2">
                <span>Position</span>
                <strong>{selectedUser.position || "N/A"}</strong>
              </div>

              <div className="user-info-box-v2">
                <span>Email</span>
                <strong>{selectedUser.email || "N/A"}</strong>
              </div>

              <div className="user-info-box-v2">
                <span>Role</span>
                <strong>{roleLabel}</strong>
              </div>

              {(selectedUser.role === "Supplier" ||
                selectedUser.role === "Vendor") && (
                <div className="user-info-box-v2 user-info-box-wide-v2">
                  <span>Assigned Supplier</span>
                  <strong>
                    {selectedUser.vendor_name || "No supplier assigned"}
                  </strong>
                </div>
              )}
            </div>
          </section>

          <section className="user-panel-v2">
            <div className="user-panel-heading-v2">
              <div>
                <span>ACCESS</span>
                <h3>Permissions</h3>
              </div>

              <span className="user-access-pill-v2">{accessLabel}</span>
            </div>

            <div className="user-access-summary-v2">
              <div>
                <span>Access Configuration</span>
                <strong>{accessLabel}</strong>
              </div>

              <div>
                <span>Modules Assigned</span>
                <strong>{modulePermissions.length}</strong>
              </div>
            </div>

            <div className="user-modules-block-v2">
              <span>Module Access</span>

              <div className="user-module-list-v2">
                {modulePermissions.length > 0 ? (
                  modulePermissions.map((permission) => (
                    <em key={permission}>{getModuleLabel(permission)}</em>
                  ))
                ) : (
                  <small>No module assigned</small>
                )}
              </div>
            </div>
          </section>

          <section className="user-panel-v2">
            <div className="user-panel-heading-v2">
              <div>
                <span>ACTIVITY</span>
                <h3>Account Status</h3>
              </div>
            </div>

            <div className="user-status-grid-v2">
              <div className="user-status-box-v2">
                <span>Status</span>
                <strong>{selectedUser.status || "N/A"}</strong>
                <small>Current account state</small>
              </div>

              <div className="user-status-box-v2">
                <span>Password</span>
                <strong>{getPasswordStatus(selectedUser)}</strong>
                <small>Password requirement</small>
              </div>

              <div className="user-status-box-v2">
                <span>Last Login</span>
                <strong>{selectedUser.last_login || "Not logged in yet"}</strong>
                <small>Most recent access</small>
              </div>

              <div className="user-status-box-v2">
                <span>Created</span>
                <strong>{selectedUser.created_at || "N/A"}</strong>
                <small>Account creation date</small>
              </div>
            </div>
          </section>
        </div>

        <div className="user-modal-actions user-details-actions-v2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


function CredentialModal({ title, credential, onClose, copyText }) {
  return (
    <div className="user-modal-overlay">
      <div className="user-modal-box user-credential-modal">
        <div className="user-modal-header user-credential-header">
          <div>
            <h2>{title}</h2>
            <p>The account is ready and the login credentials are shown below.</p>
          </div>

          <button type="button" className="user-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="user-credential-content">
          <div className="user-credential-hero">
            <div className="user-credential-icon">
              <CheckCircle size={28} />
            </div>

            <div>
              <strong>Account Created</strong>
              <p>Keep the temporary password secure until the user signs in.</p>
            </div>
          </div>

          <div className="user-credential-details">
            <div className="detail-row">
              <span>Name</span>
              <strong>{credential.full_name}</strong>
            </div>

            <div className="detail-row">
              <span>Position</span>
              <strong>{credential.position || "N/A"}</strong>
            </div>

            <div className="detail-row">
              <span>Email</span>
              <strong>{credential.email}</strong>
            </div>

            <div className="detail-row">
              <span>Role</span>
              <strong>{credential.role}</strong>
            </div>

            <div className="detail-row user-credential-password-row">
              <span>Temporary Password</span>
              <strong>{credential.default_password}</strong>
            </div>
          </div>

          <div className="user-credential-note">
            <AlertTriangle size={18} />
            <div>
              <strong>Password Change Required</strong>
              <p>This user must change the temporary password after logging in.</p>
            </div>
          </div>

          <div
            className={`user-credential-email-status ${
              credential.email_sent ? "success" : "failed"
            }`}
          >
            <div>
              <strong>
                {credential.email_sent
                  ? "Email Sent Successfully"
                  : "Email Sending Failed"}
              </strong>

              <p>
                {credential.email_sent
                  ? "The login credentials were sent to the registered email address."
                  : String(
                      credential.email_result ||
                        "No email error returned."
                    )}
              </p>
            </div>
          </div>
        </div>

        <div className="user-modal-actions user-credential-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => copyText(credential.default_password)}
          >
            <Copy size={16} />
            Copy Password
          </button>

          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageModal({ type = "info", title, message, onClose }) {
  const isSuccess = type === "success";
  const isError = type === "error";

  return (
    <div className="user-modal-overlay">
      <div className="user-modal-box">
        <div className="user-modal-header">
          <h2>{title}</h2>
          <button type="button" className="user-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="user-message-body">
          <div className="user-message-icon">
            {isSuccess ? (
              <CheckCircle size={28} />
            ) : isError ? (
              <AlertTriangle size={28} />
            ) : (
              <Info size={28} />
            )}
          </div>
          <p>{message}</p>
        </div>

        <div className="user-modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ type = "warning", title, message, confirmLabel, onCancel, onConfirm }) {
  const isDanger = type === "danger";

  return (
    <div className="user-modal-overlay">
      <div className="user-modal-box">
        <div className="user-modal-header">
          <h2>{title}</h2>
          <button type="button" className="user-modal-close" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="user-message-body">
          <div className="user-message-icon">
            <AlertTriangle size={28} />
          </div>
          <p>{message}</p>
        </div>

        <div className="user-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>

          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;