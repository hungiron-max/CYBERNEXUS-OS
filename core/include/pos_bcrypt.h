#ifndef POS_BCRYPT_H
#define POS_BCRYPT_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define BCRYPT_HASHSPACE 64

// Check a plaintext password against a bcrypt hash ($2a$, $2b$, $2y$, $2x$)
// Returns 0 if password matches, -1 on mismatch or error.
int pos_bcrypt_checkpw(const char *pass, const char *hash);

// Hash a password using provided salt
// Returns 0 on success, -1 on error.
int pos_bcrypt_hashpass(const char *pass, const char *salt, char *hash, size_t hash_len);

// Generate standard $2y$ salt from 16 random bytes
int pos_bcrypt_gensalt(int log_rounds, const unsigned char *csalt16, char *salt, size_t salt_len);

#ifdef __cplusplus
}
#endif

#endif // POS_BCRYPT_H
