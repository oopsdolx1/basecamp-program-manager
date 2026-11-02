import { VirtualInput, VirtualInputProvider } from "@uiwwsw/virtual-keyboard";

export const KioskMemberKeyboard = ({ value, onChange, mode = "hangul" }: { value: string; onChange: (value: string) => void; mode?: "hangul" | "tel" }): JSX.Element => (
  <VirtualInputProvider defaultHangulMode locale="ko" theme="dark" keyboardVisibility="always">
    <VirtualInput aria-label="회원 이름 또는 전화번호 검색" className="kiosk-member-keyboard" mode={mode} onValueChange={onChange} placeholder="이름 또는 전화번호로 검색" value={value} />
  </VirtualInputProvider>
);
