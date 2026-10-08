type C = { name?: string | null; email?: string | null; phone?: string | null; address?: string | null };

export function CustomerFields({ c = {} }: { c?: C }) {
  return (
    <>
      <div>
        <label className="label">Name *</label>
        <input className="input" name="name" required defaultValue={c.name ?? ""} />
      </div>
      <div>
        <label className="label">E-Mail</label>
        <input className="input" name="email" type="email" defaultValue={c.email ?? ""} />
      </div>
      <div>
        <label className="label">Telefon</label>
        <input className="input" name="phone" defaultValue={c.phone ?? ""} />
      </div>
      <div>
        <label className="label">Adresse</label>
        <textarea className="input" name="address" rows={2} defaultValue={c.address ?? ""} />
      </div>
    </>
  );
}
