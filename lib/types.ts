export interface Category {
  id: string;
  knowledge_base_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  created_at: string;
}

export interface KnowledgeNode {
  id: string;
  knowledge_base_id: string;
  label: string;
  content: string;
  category_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEdge {
  id: string;
  knowledge_base_id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  strength: number;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  knowledge_base_id: string;
  role: "user" | "assistant";
  content: string;
  message_type: MessageType;
  created_at: string;
}

export type MessageType = "feed" | "question" | "system";

export interface NodeWithCategory extends KnowledgeNode {
  category: Category | null;
}

export interface GraphNode {
  id: string;
  label: string;
  content: string;
  color: string;
  categoryId: string | null;
  val: number;
  _growStart?: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  label: string;
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface FeedResponseJSON {
  nodes: Array<{
    label: string;
    content: string;
    category: string;
    isExisting: boolean;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationship: string;
    strength: number;
  }>;
  summary: string;
}

export interface ExportPayload {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  categories: Category[];
}
