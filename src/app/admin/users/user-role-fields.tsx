"use client";

import { useState } from "react";

export function UserRoleFields({
  customers,
  role: initialRole = "customer",
  customerId,
}: {
  customers: { id: string; name: string }[];
  role?: "admin" | "customer";
  customerId?: string | null;
}) {
  const [role, setRole] = useState(initialRole);
  return (
    <>
      <div>
        <label className="label">Rolle</label>
        <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "customer")}>
          <option value="customer">Kunde</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {role === "customer" && (
        <div>
          <label className="label">Kunde *</label>
          <select className="input" name="customerId" defaultValue={customerId ?? ""} required>
            <option value="" disabled>
              Bitte wählen …
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
