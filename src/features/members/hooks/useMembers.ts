import { useEffect, useState } from "react";
import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import type { AppId } from "../../../types/brandedIds";
import type { Loadable } from "../../../types/common.types";
import { subscribeMembers, type SubscribeMembersResult } from "../repositories/profileRepository";

const initialData: SubscribeMembersResult = {
  members: [],
  diagnostics: {
    totalDocuments: 0,
    memberDocuments: 0,
    excludedByRole: 0,
    missingRole: 0,
    missingName: 0,
    idMismatches: 0,
    legacyContactFallbacks: 0,
    legacyNoteFallbacks: 0,
  },
};

export const useMembers = (appId: AppId): Loadable<SubscribeMembersResult> => {
  const [state, setState] = useState<Loadable<SubscribeMembersResult>>({
    status: "loading",
    data: initialData,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    setState({ status: "loading", data: initialData });

    ensureFirebaseAuth()
      .then(() => {
        if (!active) {
          return;
        }

        unsubscribe = subscribeMembers(
          { appId },
          {
            next: (data) => setState({ status: "ready", data }),
            error: (error) =>
              setState({
                status: "error",
                data: initialData,
                message: `${error.userMessage} (${error.developerMessage})`,
              }),
          },
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown auth error";
        setState({
          status: "error",
          data: initialData,
          message: `Firebase 인증에 실패했습니다. (${message})`,
        });
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [appId]);

  return state;
};
