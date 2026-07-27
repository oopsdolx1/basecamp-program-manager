export const formatRequestedAt = (date: Date): string =>
  date.getTime() === 0
    ? "-"
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
