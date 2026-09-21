import axios from "axios";
export const api = axios.create({ baseURL: "/api/v1", timeout: 60000 });
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login")
    )
      window.dispatchEvent(new Event("session-expired"));
    return Promise.reject(error);
  },
);
export function message(e: unknown) {
  if (axios.isAxiosError(e)) {
    const detail = e.response?.data?.detail;
    return typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((x: { msg: string }) => x.msg).join("; ")
        : e.message;
  }
  return "Something went wrong. Please try again.";
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
export const number = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(n);
