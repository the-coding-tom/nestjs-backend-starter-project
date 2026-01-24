export class CreateWorkspaceData {
  name: string;
  slug: string;
  image?: string | null;
  ownerId: number;
  [key: string]: any;
}

export class UpdateWorkspaceData {
  name?: string;
  slug?: string;
  image?: string | null;
  [key: string]: any;
}

export class WorkspaceResponseEntity {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkspaceListItemEntity {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: string;
}

