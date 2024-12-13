import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

function checkSupabaseConfig() {
  // Load environment variables
  dotenv.config();

  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  console.log('Checking Supabase Configuration...\n');

  // Check environment variables
  console.log('Environment Variables:');
  requiredVars.forEach(varName => {
    const exists = process.env[varName] !== undefined;
    console.log(`${varName}: ${exists ? '✅ Present' : '❌ Missing'}`);
    
    if (exists) {
      // Only check URL format for the URL variable
      if (varName === 'SUPABASE_URL') {
        try {
          new URL(process.env[varName]!);
          console.log(`  URL format: ✅ Valid`);
        } catch {
          console.log(`  URL format: ❌ Invalid`);
        }
      }
      
      // Check key length for API keys
      if (varName.includes('KEY')) {
        const keyLength = process.env[varName]!.length;
        console.log(`  Key length: ${keyLength} characters`);
      }
    }
  });

  // Check for Supabase client initialization in common locations
  const commonFiles = [
    'src/lib/supabase.ts',
    'src/utils/supabase.ts',
    'app/lib/supabase.ts',
    'lib/supabase.ts'
  ];

  console.log('\nChecking for Supabase client initialization:');
  commonFiles.forEach(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    console.log(`${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
  });
}

checkSupabaseConfig(); 