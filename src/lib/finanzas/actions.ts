"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import {
  getGastosTabData,
  getCalendarioTabData,
  createMovimiento,
  updateMovimiento,
  deleteMovimiento,
  markMovimientoPaid,
  markMovimientoPending,
  type FinanzasMovimientoInput,
  type GastosTabData,
  type CalendarioTabData,
} from "./queries";

function revalidateFinanzas() {
  revalidatePath("/cobranza");
}

export async function getGastosTabDataAction(params: { month: string; search?: string; medioPago?: string; categoria?: string }): Promise<GastosTabData> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  return getGastosTabData(workspaceId, params);
}

export async function getCalendarioTabDataAction(params: {
  gridStart: string;
  gridEnd: string;
  tipo?: "in" | "out";
  search?: string;
  categoria?: string;
}): Promise<CalendarioTabData> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  return getCalendarioTabData(workspaceId, params);
}

export async function createMovimientoAction(input: FinanzasMovimientoInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  const memberId = await getCurrentMemberId(workspaceId);
  await createMovimiento(workspaceId, memberId, input);
  revalidateFinanzas();
}

export async function updateMovimientoAction(id: string, input: FinanzasMovimientoInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  await updateMovimiento(workspaceId, id, input);
  revalidateFinanzas();
}

export async function deleteMovimientoAction(id: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  await deleteMovimiento(workspaceId, id);
  revalidateFinanzas();
}

export async function markMovimientoPaidAction(id: string, fechaPago?: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  const memberId = await getCurrentMemberId(workspaceId);
  await markMovimientoPaid(workspaceId, memberId, id, fechaPago);
  revalidateFinanzas();
}

export async function markMovimientoPendingAction(id: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  await markMovimientoPending(workspaceId, id);
  revalidateFinanzas();
}
