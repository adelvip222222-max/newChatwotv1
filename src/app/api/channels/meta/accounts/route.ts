import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token, type } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 400 });
    }

    const accounts: Array<{ id: string; name: string; accessToken: string; extraId?: string }> = [];
    
    if (type === "facebook" || type === "instagram") {
      // Fetch Facebook Pages
      const fbResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
      const fbData = await fbResponse.json();
      
      if (fbData.error) throw new Error(fbData.error.message);
      
      if (type === "facebook") {
        accounts.push(...fbData.data.map((page: any) => ({
          id: page.id,
          name: page.name,
          accessToken: page.access_token
        })));
      } else if (type === "instagram") {
        // Fetch IG accounts linked to these pages
        for (const page of fbData.data) {
          const igResponse = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${token}`);
          const igData = await igResponse.json();
          if (igData.instagram_business_account) {
             accounts.push({
               id: igData.instagram_business_account.id,
               name: `${page.name} (Instagram)`,
               accessToken: page.access_token // Usually you use page token for IG Graph API
             });
          }
        }
      }
    } else if (type === "whatsapp") {
      // WhatsApp Business Accounts via Business Manager
      const waResponse = await fetch(`https://graph.facebook.com/v19.0/me/businesses?access_token=${token}`);
      const waData = await waResponse.json();
      if (waData.error) throw new Error(waData.error.message);

      for (const business of waData.data) {
         const phonesResponse = await fetch(`https://graph.facebook.com/v19.0/${business.id}/whatsapp_business_accounts?fields=phone_numbers&access_token=${token}`);
         const phonesData = await phonesResponse.json();
         if (phonesData.data && phonesData.data.length > 0) {
            for (const waba of phonesData.data) {
              if (waba.phone_numbers && waba.phone_numbers.data) {
                for (const phone of waba.phone_numbers.data) {
                  accounts.push({
                    id: phone.id, // PhoneNumber ID
                    name: phone.display_phone_number,
                    accessToken: token, // WA uses the system user or user token
                    extraId: waba.id // WABA ID if needed
                  });
                }
              }
            }
         }
      }
    }

    return NextResponse.json({ ok: true, accounts });
  } catch (error: any) {
    console.error("Fetch Meta Accounts Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch accounts" }, { status: 400 });
  }
}
