export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Einmalig anzuzeigendes Geheimnis (Token/Passwort) – wird nirgends gespeichert. */
  secret?: string;
  secretLabel?: string;
};

export const initialActionState: ActionState = {};
