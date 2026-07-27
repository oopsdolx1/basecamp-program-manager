import { Container } from "@mui/material";
import type { PropsWithChildren } from "react";

export const PageContainer = ({ children }: PropsWithChildren): JSX.Element => (
  <Container maxWidth="xl" sx={{ py: { md: 3, xs: 2 } }}>
    {children}
  </Container>
);
