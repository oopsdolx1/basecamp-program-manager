import { Container } from "@mui/material";
import type { PropsWithChildren } from "react";

export const PageContainer = ({ children }: PropsWithChildren): JSX.Element => (
  <Container maxWidth={false} sx={{ maxWidth: 1520, px: { lg: 5, md: 3, xs: 2 }, py: { md: 4, xs: 2 } }}>
    {children}
  </Container>
);
