import serial
import time

# Port 1 in VirtualBox settings usually maps to /dev/ttyS0 in Linux
SERIAL_PORT = "/dev/ttyS2"
BAUD_RATE = 9600


def test_connection():
    try:
        # Initialize the serial connection
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        ser.reset_input_buffer()
        print(f"--- Connection established on {SERIAL_PORT} ---")

        while True:
            # Read line from Arduino
            if ser.in_waiting > 0:
                line = ser.readline().decode("utf-8").rstrip()
                print(f"Received: {line}")

                # Send a confirmation back to the Arduino
                ser.write(b"ACK from Pi\n")

    except serial.SerialException as e:
        print(f"Error: {e}")
    except KeyboardInterrupt:
        print("\nStopping test...")
    finally:
        if "ser" in locals():
            ser.close()


if __name__ == "__main__":
    test_connection()
