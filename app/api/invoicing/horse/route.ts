import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {timingSafeEqual} from 'node:crypto'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const noStore={'Cache-Control':'no-store, private'}
function authorized(request:NextRequest){
 const expected=process.env.OPTIMUS_INVOICING_API_TOKEN
 const received=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')??''
 if(!expected||expected.length<32||!received)return false
 const a=Buffer.from(expected),b=Buffer.from(received)
 return a.length===b.length&&timingSafeEqual(a,b)
}
export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401,headers:noStore})
 const url=process.env.SUPABASE_URL??'https://rqcjcikemgcqcgxltjfe.supabase.co'
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!key)return NextResponse.json({error:'Invoicing integration not configured'},{status:503,headers:noStore})
 const horseId=request.nextUrl.searchParams.get('horse_id')
 if(!horseId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(horseId)){
  return NextResponse.json({error:'Valid horse_id UUID required'},{status:400,headers:noStore})
 }
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await client.from('horses').select('id,name,horse_type,stable_location,pasture_name,box_number,active').eq('id',horseId).single()
 if(error||!data)return NextResponse.json({error:'Horse not found'},{status:404,headers:noStore})
 return NextResponse.json({horse:{id:data.id,name:data.name,horse_type:data.horse_type,location:data.stable_location,pasture:data.pasture_name,box:data.box_number,active:data.active},invoice_status:'draft_only',note:'Customer details, prices, VAT and payment terms must be supplied and verified by the invoicing application.'},{headers:noStore})
}
