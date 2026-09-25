import { LAUNCH_PACKAGE_CHOICES, parseStatus, type Brief, type Project } from '@/lib/domain/projects';
import type { MemberClient } from '@/lib/auth/session';

/**
 * Member-scoped Wix reads and writes for the client portal.
 * The Projects collection is readable only by the member who created each item (SITE_MEMBER_AUTHOR),
 * so a query here returns the signed-in client's projects and nobody else's.
 */

export const PROJECTS_COLLECTION = 'Projects';

export interface MemberProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface MemberPlan {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PENDING' | 'PAUSED' | 'ENDED' | 'CANCELED' | 'DRAFT' | 'UNDEFINED';
  startDate: string | null;
  endDate: string | null;
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const url = (value: unknown): string | null => {
  const s = str(value);
  return /^https?:\/\//.test(s) ? s : null;
};
const isoDate = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && '$date' in value) return str((value as { $date: unknown }).$date) || null;
  return null;
};

export async function getMemberProfile(client: MemberClient): Promise<MemberProfile | null> {
  const { member } = await client.members.getCurrentMember({ fieldsets: ['FULL'] });
  if (!member?._id) return null;
  return {
    id: member._id,
    email: member.loginEmail ?? '',
    firstName: member.contact?.firstName ?? member.profile?.nickname ?? '',
    lastName: member.contact?.lastName ?? '',
  };
}

function toProject(item: Record<string, unknown>): Project {
  return {
    id: str(item['_id']),
    title: str(item['title']) || 'Your launch',
    status: parseStatus(str(item['status'])),
    nextStep: str(item['nextStep']),
    clientNote: str(item['clientNote']),
    previewUrl: url(item['previewUrl']),
    liveUrl: url(item['liveUrl']),
    filesUrl: url(item['filesUrl']),
    targetLaunchDate: isoDate(item['targetLaunchDate']),
    depositReceived: item['depositReceived'] === true,
    packageSlug: str(item['packageSlug']),
    createdAt: isoDate(item['_createdDate']),
  };
}

export async function listProjects(client: MemberClient): Promise<Project[]> {
  const result = await client.items.query(PROJECTS_COLLECTION).descending('_createdDate').limit(20).find();
  return result.items.map((item) => toProject(item as Record<string, unknown>));
}

export async function createProject(client: MemberClient, brief: Brief, email: string, businessTypeLabel: string): Promise<Project> {
  const packageLabel = LAUNCH_PACKAGE_CHOICES.find((p) => p.value === brief.packageSlug)?.label ?? brief.packageSlug;
  const item = await client.items.insert(PROJECTS_COLLECTION, {
    title: brief.title,
    status: 'brief_received',
    nextStep: 'We will confirm your scope, price and launch date within one working day.',
    packageSlug: brief.packageSlug === 'unsure' ? '' : brief.packageSlug,
    businessType: businessTypeLabel,
    location: brief.location,
    ...(brief.currentWebsite ? { currentWebsite: brief.currentWebsite } : {}),
    assetsReady: brief.assetsReady,
    goals: `${brief.goals}\n\nPackage interest: ${packageLabel}.`,
    ...(brief.contactPhone ? { contactPhone: brief.contactPhone } : {}),
    memberEmail: email,
    depositReceived: false,
  });
  return toProject(item as Record<string, unknown>);
}

export async function listMemberPlans(client: MemberClient): Promise<MemberPlan[]> {
  const { orders } = await client.orders.memberListOrders({});
  return (orders ?? [])
    .filter((o) => o._id && o.status !== 'DRAFT' && o.status !== 'UNDEFINED')
    .map((o) => ({
      id: o._id ?? '',
      name: o.planName || 'Run plan',
      status: (o.status ?? 'UNDEFINED') as MemberPlan['status'],
      startDate: o.startDate ? new Date(o.startDate).toISOString() : null,
      endDate: o.endDate ? new Date(o.endDate).toISOString() : null,
    }));
}
