import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	startPsSession,
	endPsSession,
	switchPsSessionMode,
	pausePsSession,
	resumePsSession,
	updatePsSessionTimer,
	updatePsSessionStartTime,
	addPsSessionOrder,
	removePsSessionOrder,
	addPsSessionCharge,
	updatePsSessionCharge,
	deletePsSessionCharge,
	updatePsSessionCostLimit,
} from '$lib/server/convex';

/**
 * POST /api/playstation/mutation
 * Routes client-side mutations to server-side SQLite functions.
 * Replaces Convex client.mutation() calls.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, args } = await request.json();

		let result: any;

		switch (action) {
			case 'startSession':
				result = await startPsSession(
					args.stationId,
					args.startedBy || 'manual',
					args.timerMinutes,
					args.costLimitPiasters,
				);
				break;

			case 'endSession':
				result = await endPsSession(args.id, undefined, args.customTotalCost);
				break;

			case 'switchMode':
				result = await switchPsSessionMode(args.id, args.newMode);
				break;

			case 'pauseSession':
				result = await pausePsSession(args.id, args.source || 'ui-manual');
				break;

			case 'resumeSession':
				result = await resumePsSession(args.id);
				break;

			case 'updateTimer':
				result = await updatePsSessionTimer(args.id, args.timerMinutes, args.timerNotified);
				break;

			case 'updateStartTime':
				result = await updatePsSessionStartTime(args.id, args.newStartTime);
				break;

			case 'updateCostLimit':
				result = await updatePsSessionCostLimit(args.id, args.costLimitPiasters, args.costLimitNotified);
				break;

			case 'addOrder':
				result = await addPsSessionOrder(args.sessionId, args.menuItemId, args.quantity);
				break;

			case 'removeOrder':
				result = await removePsSessionOrder(args.orderId);
				break;

			case 'addCharge':
				result = await addPsSessionCharge(args.sessionId, args.amount, args.reason);
				break;

			case 'updateCharge':
				result = await updatePsSessionCharge(args.chargeId, args.amount, args.reason);
				break;

			case 'deleteCharge':
				result = await deletePsSessionCharge(args.chargeId);
				break;

			default:
				return json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
		}

		return json({ success: true, result });
	} catch (error) {
		console.error('[PS Mutation] Error:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};
