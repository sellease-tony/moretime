import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guestContactSchema} from '../lib/bookings/guest';
import {bookingSchema} from '../lib/workspace';
test('anonymous booking contact needs no account and normalizes notification destinations',()=>{
  const contact=guestContactSchema.parse({name:' 예약자 ',email:' Guest@Example.com ',phone:'010-1234-5678'});
  assert.deepEqual(contact,{name:'예약자',email:'guest@example.com',phone:'01012345678'});
  const booking=bookingSchema.parse({id:'a0000000-0000-4000-8000-000000000001',eventId:'meeting',title:'미팅',duration:30,day:'2030-01-01',time:'10:00',...contact,channels:['email'],notificationConsent:true});
  assert.equal(booking.email,'guest@example.com');assert.equal(booking.phone,'01012345678');
  assert.equal(bookingSchema.safeParse({...booking,notificationConsent:false}).success,false);
});
test('guest contact rejects missing identity, invalid email and missing or invalid phone',()=>{
  const valid={name:'예약자',email:'guest@example.com',phone:'01012345678'};
  for(const patch of [{name:''},{email:''},{email:'not-an-email'},{phone:''},{phone:'123'}])assert.equal(guestContactSchema.safeParse({...valid,...patch}).success,false);
  assert.equal(guestContactSchema.safeParse(null).success,false);
});
