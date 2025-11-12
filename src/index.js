const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.plShiftUpdate = functions.https.onRequest(async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).send("Use POST");
  }

  try {
    const { shiftId, shiftName, timestamp } = req.body;

    if (!shiftId || !shiftName) {
      return res.status(400).send("shiftId and shiftName are required.");
    }

    await admin.firestore()
      .collection("plShifts")
      .doc(shiftId)
      .set({
        shiftName,
        timestamp: timestamp || new Date().toISOString(),
      }, { merge: true });

    return res.status(200).send({ success: true, message: "Shift stored in Firestore." });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).send({ success: false, error: err.message });
  }
});
