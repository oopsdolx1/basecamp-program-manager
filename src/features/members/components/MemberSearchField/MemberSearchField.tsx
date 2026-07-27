import { SearchField } from "../../../../components/common/SearchField";

interface MemberSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const MemberSearchField = ({ value, onChange }: MemberSearchFieldProps): JSX.Element => (
  <SearchField label="회원 이름 또는 전화번호 검색" value={value} onChange={onChange} />
);
