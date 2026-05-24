import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { ChatMessage } from './components/Chat';
import chroma from 'chroma-js';

export type ChatTargetType = 'article' | 'shot' | 'podcast';

export interface ChatPoster {
  id: string;
  display_name: string;
  provider: string;
}

export interface ChatComment {
  id: string;
  text: string;
  created_at: number;
  poster: ChatPoster;
}

const GET_COMMENTS = gql`
  query GetComments($targetType: CommentTargetType!, $targetId: Int!) {
    getComments(targetType: $targetType, targetId: $targetId) {
      id
      text
      created_at
      poster { id display_name provider }
    }
  }
`;

const NEW_COMMENT = gql`
  subscription NewComment($targetType: CommentTargetType!, $targetId: Int!) {
    newComment(targetType: $targetType, targetId: $targetId) {
      id
      text
      created_at
      poster { id display_name provider }
    }
  }
`;

const POST_COMMENT = gql`
  mutation PostComment(
    $targetType: CommentTargetType!
    $targetId: Int!
    $text: String!
    $displayName: String!
  ) {
    postComment(
      targetType: $targetType
      targetId: $targetId
      text: $text
      displayName: $displayName
    ) {
      id
      text
      created_at
      poster { id display_name provider }
    }
  }
`;

// Sort oldest-first and dedup by id. The merge order matters: events that
// arrive via subscription and events that come back from the query may
// overlap, and we must keep exactly one copy of each.
function mergeDedup(a: ChatComment[], b: ChatComment[]): ChatComment[] {
  const byId = new Map<string, ChatComment>();
  for (const c of a) byId.set(c.id, c);
  for (const c of b) byId.set(c.id, c);
  return Array.from(byId.values()).sort((x, y) => x.created_at - y.created_at);
}

// Polynomial rolling hash (base 31, like Java's String.hashCode): each char
// code is folded in as hash = hash * 31 + code, kept in 32-bit range via `| 0`.
// The result is mapped onto a 0-359 hue so a given name always yields the same
// color.
function hueFromName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return ((hash % 360) + 360) % 360;
}

function avatarFor(name: string) {
    return {
        color: chroma.hsl(hueFromName(name), 0.7, 0.65).hex(),
        initial: (name[0] ?? "?").toUpperCase(),
    };
}

function toChatMessage(c: ChatComment): ChatMessage {
    return {
        avatar: avatarFor(c.poster.display_name),
        name: c.poster.display_name,
        text: c.text,
    };
}

// Hook for the chat. Race-safe load:
//   1. The subscription opens on mount and starts buffering events.
//   2. The query fetches historical messages.
//   3. When the query resolves, we merge (query result, buffer) and switch
//      to "live" mode where new events go straight into state.
// Any event that arrives during step 1-2 ends up in the buffer; any event
// that the server sends before our subscription is actually live ends up
// in the query result. Dedup by id collapses overlap.
export function useChat(targetType: ChatTargetType, targetId: number) {
  const [rawMessages, setRawMessages] = useState<ChatComment[]>([]);
  const messages = useMemo(() => rawMessages.map(toChatMessage), [rawMessages]);
  
  // Refs because the useSubscription onData closure captures these at the
  // time the callback is registered — without refs we'd read a stale
  // `liveMode` value forever.
  const liveModeRef = useRef(false);
  const bufferRef = useRef<ChatComment[]>([]);

  useSubscription(NEW_COMMENT, {
    variables: { targetType, targetId },
    onData: ({ data }) => {
      const c = data?.data?.newComment as ChatComment | undefined;
      if (!c) return;
      if (liveModeRef.current) {
        setRawMessages((prev) => mergeDedup(prev, [c]));
      } else {
        bufferRef.current.push(c);
      }
    },
  });

  const { data, loading, error } = useQuery(GET_COMMENTS, {
    variables: { targetType, targetId },
    // Always go to the network on mount — cache could be stale relative
    // to what the subscription has been buffering.
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    if (loading || !data) return;
    const history = (data.getComments ?? []) as ChatComment[];
    setRawMessages(mergeDedup(history, bufferRef.current));
    bufferRef.current = [];
    liveModeRef.current = true;
  }, [loading, data]);

  const [postComment, { loading: sending }] = useMutation(POST_COMMENT);

  const sendMessage = useCallback(
    async (text: string, displayName: string) => {
      if (!text.trim()) return;
      // We don't need to push the returned comment into state ourselves —
      // the subscription receives the same event (because the resolver
      // calls pubsub.publish) and will add it via onData.
      await postComment({
        variables: { targetType, targetId, text, displayName },
      });
    },
    [postComment, targetType, targetId],
  );

  return { messages, loading, error, sendMessage, sending };
}
