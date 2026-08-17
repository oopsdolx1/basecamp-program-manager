import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogProps } from "@mui/material";
import type { ReactNode } from "react";
import { colors, radius, spacing } from "../../tokens";
export interface ModalProps extends Omit<DialogProps, "title"> { title: ReactNode; actions?: ReactNode }
export const Modal = ({ title, actions, children, ...props }: ModalProps): JSX.Element => <Dialog {...props} PaperProps={{ sx: { bgcolor: colors.neutral.gray900, border: `1px solid ${colors.neutral.gray700}`, borderRadius: `${radius.md}px`, color: colors.neutral.white, minWidth: { md: 480, xs: "calc(100% - 32px)" } } }}><DialogTitle sx={{ p: `${spacing[6]}px` }}>{title}</DialogTitle><DialogContent sx={{ p: `${spacing[6]}px` }}>{children}</DialogContent>{actions ? <DialogActions sx={{ p: `${spacing[4]}px ${spacing[6]}px` }}>{actions}</DialogActions> : null}</Dialog>;
