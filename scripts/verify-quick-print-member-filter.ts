import assert from "node:assert/strict";
import { filterQuickPrintMembers } from "../src/features/printing/services/memberSelectionFilterService";
import type { MemberSelectionItem } from "../src/features/members/types/memberViewModel.types";

const seed = ["김경원", "김도연", "라형연", "박서윤", "송은희", "오지훈"];
const members = Array.from({ length: 40 }, (_, index) => {
  const displayName = seed[index] ?? `회원${String(index).padStart(2, "0")}`;
  return { memberId: `member-${index}` as MemberSelectionItem["memberId"], displayName, phone: `010-0000-${String(index).padStart(4, "0")}`, searchText: displayName };
});

assert.equal(filterQuickPrintMembers(members, "", null).length, 0, "initial state hides all members");
assert.deepEqual(filterQuickPrintMembers(members, "", "ㄱ").map(({ displayName }) => displayName), ["김경원", "김도연"], "ㄱ filters Korean initial");
assert.deepEqual(filterQuickPrintMembers(members, "", "ㅇ").map(({ displayName }) => displayName), ["오지훈"], "ㅇ filters Korean initial");
assert.deepEqual(filterQuickPrintMembers(members, "010-0000-0003", null).map(({ displayName }) => displayName), ["박서윤"], "search takes precedence over no initial");
assert.equal(filterQuickPrintMembers(members, "", null).length, 0, "clearing a selected initial restores the hidden initial state");
console.log("Quick Print member filter checks: PASS");
