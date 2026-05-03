"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserDeleted = exports.setOrgClaim = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
admin.initializeApp();
/**
 * Called by the client after registration or login to set organisationId as a custom claim.
 * Custom claims are embedded in the JWT, making security rules fast (no DB read).
 */
exports.setOrgClaim = functions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const { data } = request;
    const requestedOrgId = data?.organisationId;
    if (requestedOrgId !== undefined && typeof requestedOrgId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'organisationId must be a string');
    }
    // Prevent a user from claiming a different org by validating against Firestore.
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists)
        throw new functions.https.HttpsError('not-found', 'User not found');
    const storedOrgId = userDoc.data()?.organisationId;
    if (!storedOrgId || typeof storedOrgId !== 'string') {
        throw new functions.https.HttpsError('failed-precondition', 'User has no organisation');
    }
    if (requestedOrgId !== undefined && storedOrgId !== requestedOrgId) {
        throw new functions.https.HttpsError('permission-denied', 'Org mismatch');
    }
    await admin.auth().setCustomUserClaims(uid, {
        orgId: storedOrgId,
        role: userDoc.data()?.role ?? 'viewer',
    });
    return { success: true };
});
/**
 * Triggered on user deletion to clean up Firestore data.
 */
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
    await admin.firestore().collection('users').doc(user.uid).delete();
});
//# sourceMappingURL=index.js.map