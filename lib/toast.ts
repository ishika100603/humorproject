// Fire a toast from anywhere: toast("success", "Approved!", "3 captions posted.")
export type ToastKind = "success" | "error";
export type ToastDetail = { kind: ToastKind; title: string; message?: string };

export function toast(kind: ToastKind, title: string, message?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>("app-toast", { detail: { kind, title, message } }));
}
