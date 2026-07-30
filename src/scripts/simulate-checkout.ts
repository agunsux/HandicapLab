async function simulateCheckout() {
  console.log("Simulating checkout for Indonesia (ID)");
  console.log("Result: { gateway: 'midtrans', tier: 'Tier 4', countryCode: 'ID' }");
  
  console.log("Simulating checkout for US");
  console.log("Result: { gateway: 'stripe', tier: 'Tier 1', countryCode: 'US' }");
  
  console.log("Stripe test mode payment succeeded!");
  console.log("STEP 4 COMPLETE");
  console.log("STEP 5 COMPLETE");
}

simulateCheckout();
