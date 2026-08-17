import { Breadcrumbs, Link, Typography } from "@mui/material";
import { colors } from "../../tokens";
export interface BreadcrumbItem { label: string; href?: string }
export const Breadcrumb = ({ items }: { items: BreadcrumbItem[] }): JSX.Element => <Breadcrumbs aria-label="breadcrumb">{items.map((item, index) => item.href ? <Link color={colors.neutral.gray300} href={item.href} key={`${item.href}-${item.label}`}>{item.label}</Link> : <Typography color={index === items.length - 1 ? colors.neutral.white : colors.neutral.gray300} key={item.label}>{item.label}</Typography>)}</Breadcrumbs>;
