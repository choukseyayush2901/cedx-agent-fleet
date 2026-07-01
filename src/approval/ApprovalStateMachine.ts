import type { Amendment, Approval, ApprovalState, DeliveredFields } from "../types/contracts.js";
import { nowIso } from "../utils/dates.js";

const transitions: Record<ApprovalState, ApprovalState[]> = {
  draft: ["in_review", "blocked"],
  in_review: ["changes_requested", "approved", "blocked"],
  changes_requested: ["in_review", "blocked"],
  approved: ["delivered", "blocked"],
  delivered: [],
  blocked: ["in_review"],
};

export class ApprovalStateMachine {
  canTransition(from: ApprovalState, to: ApprovalState): boolean {
    return transitions[from].includes(to);
  }

  transition(
    from: ApprovalState,
    to: ApprovalState,
    actor: string,
    reason?: string,
  ): Approval {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid approval transition from ${from} to ${to}`);
    }

    return {
      state: to,
      actor,
      ts: nowIso(),
      reason: reason ?? null,
    };
  }

  approveForDelivery(fields: DeliveredFields, amendment: Amendment): Approval[] {
    const approvals: Approval[] = [
      { state: "draft", actor: "system", ts: nowIso(), reason: "assembled" },
      this.transition("draft", "in_review", "operator", "ready for review"),
      this.transition("in_review", "approved", "operator", "operator approved"),
    ];

    if (fields.amount >= amendment.threshold) {
      approvals.push({
        state: "approved",
        actor: amendment.role,
        ts: nowIso(),
        reason: `case amendment approval for amount >= ${amendment.threshold}`,
      });
    }

    approvals.push(this.transition("approved", "delivered", "system", "delivery complete"));
    return approvals;
  }

  blocked(reason: string): Approval[] {
    return [
      { state: "draft", actor: "system", ts: nowIso(), reason },
      this.transition("draft", "blocked", "system", reason),
    ];
  }
}
